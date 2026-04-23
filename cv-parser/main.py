"""
HRFlow CV Parser Service
FastAPI service for parsing CVs from PDF and DOCX files.
Uses regex-based extraction for common fields.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import re
import io
from pypdf import PdfReader
from docx import Document
import uvicorn
from rapidfuzz import fuzz, process

# Global skills list for easier maintenance and fuzzy matching
SKILLS_LIST = [
    'python', 'java', 'javascript', 'typescript', 'react', 'node.js', 'nodejs',
    'angular', 'vue', 'sql', 'postgresql', 'mysql', 'mongodb', 'docker',
    'kubernetes', 'aws', 'azure', 'gcp', 'git', 'agile', 'scrum',
    'html', 'css', 'rest', 'api', 'microservices', 'ci/cd', 'devops',
    'machine learning', 'data analysis', 'excel', 'powerpoint', 'communication',
    'leadership', 'project management', 'teamwork', 'problem solving',
    # Additional technical skills
    'c#', 'c++', '.net', 'go', 'golang', 'rust', 'swift', 'kotlin', 'php', 'ruby',
    'terraform', 'ansible', 'jenkins', 'linux', 'windows', 'networking',
    'redis', 'elasticsearch', 'kafka', 'rabbitmq', 'graphql', 'spring', 'django',
    'flask', 'fastapi', 'express', 'nextjs', 'nuxt', 'svelte', 'tailwind',
    # Design & tools
    'figma', 'photoshop', 'illustrator', 'ui/ux', 'ux design', 'ui design',
    'salesforce', 'sap', 'oracle', 'power bi', 'tableau', 'jira', 'confluence',
    # Data science
    'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'spark', 'hadoop',
    'r', 'matlab', 'statistics', 'deep learning', 'nlp', 'computer vision'
]

# Skill aliases for common variations
SKILL_ALIASES = {
    'js': 'javascript', 'ts': 'typescript', 'reactjs': 'react', 'react.js': 'react',
    'node': 'node.js', 'postgres': 'postgresql', 'mongo': 'mongodb',
    'k8s': 'kubernetes', 'py': 'python', 'golang': 'go', 'csharp': 'c#',
    'dotnet': '.net', 'scikit': 'scikit-learn', 'sklearn': 'scikit-learn',
    'tf': 'tensorflow', 'aws lambda': 'aws', 'ec2': 'aws', 's3': 'aws'
}

app = FastAPI(
    title="HRFlow CV Parser",
    description="Simple OCR-based CV parser for extracting candidate information",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_text(text: str) -> str:
    """
    Normalize text from PDFs/DOCX that extract each word on a separate line.
    Joins all words together, then creates logical lines at section breaks.
    """
    # 1. Brutal whitespace cleanup: Replace ALL whitespace sequences with a single space
    # This handles \n, \r, \t, \f, etc.
    normalized = re.sub(r'\s+', ' ', text).strip()
    
    parts = normalized.split('|')
    full_text = ' | '.join(parts) # Simple join for now
    
    # We DO want to try to insert newlines for sections to help the fallback logic if needed
    # (Though we mostly rely on the normalized single-line string for regexes now)
    return full_text


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF file."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        # Normalize the text to handle word-per-line PDFs
        return normalize_text(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        docx_file = io.BytesIO(file_bytes)
        doc = Document(docx_file)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        # Apply normalization to DOCX as well to ensure consistent extraction
        return normalize_text(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")


def extract_email(text: str) -> Optional[str]:
    """Extract email from text."""
    # Improved pattern that handles more cases but avoids false positives
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text."""
    # Matches various phone formats including International/Bahraini
    phone_patterns = [
        r'\+\d{1,4}\s?\d{6,10}',  # International: +973 33430100
        r'\+\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}', # Int w/ separators
        r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', # US/Generic
        r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', # Local US
        r'\b\d{8}\b', # Simple 8 digit
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


def extract_name(text: str) -> Optional[str]:
    """
    Extract name from text using positional heuristics.
    Names typically appear BEFORE contact info (email/phone).
    """
    # Split text into lines, handling both newlines and pipe separators
    lines = [l.strip() for l in text.replace('|', '\n').split('\n') if l.strip()]

    print(f"[DEBUG] Name extraction - total lines: {len(lines)}")
    if lines:
        print(f"[DEBUG] First line: {lines[0][:80]}")

    skip_keywords = ['curriculum', 'vitae', 'resume', 'cv', 'contact', 'profile',
                     'about', 'summary', 'objective', 'experience', 'education', 'skills']
    job_title_keywords = [
        'analyst', 'developer', 'engineer', 'manager', 'director', 'consultant',
        'specialist', 'senior', 'junior', 'lead', 'architect', 'admin', 'officer',
        'data', 'product', 'designer', 'coordinator', 'executive', 'intern', 'trainee'
    ]
    name_connectors = ['bin', 'al', 'de', 'van', 'von', 'der', 'el', 'la', 'ibn']

    # STRATEGY 1: Find contact info position and look for name ABOVE it
    contact_idx = len(lines)
    for i, line in enumerate(lines):
        line_lower = line.lower()
        # Check for email or phone number
        if '@' in line or re.search(r'\+?\d[\d\s\-().]{7,}', line):
            contact_idx = i
            print(f"[DEBUG] Contact info found at line {i}: {line[:50]}")
            break

    # Search lines before contact info
    search_lines = lines[:contact_idx] if contact_idx > 0 else lines[:5]

    for line in search_lines:
        line_lower = line.lower()

        # Skip headers and section titles
        if any(skip in line_lower for skip in skip_keywords):
            continue
        # Skip job titles
        if any(title in line_lower for title in job_title_keywords):
            continue
        # Skip lines with contact info
        if '@' in line or re.search(r'\d{5,}', line):
            continue
        # Skip lines that are too long (likely descriptions)
        if len(line) > 50:
            continue

        # Check if line looks like a name (2-5 words, properly capitalized)
        words = line.split()
        if 2 <= len(words) <= 5:
            is_valid_name = True
            for w in words:
                if not w:
                    continue
                # Word should start with uppercase OR be a connector
                if not (w[0].isupper() or w.lower() in name_connectors):
                    is_valid_name = False
                    break
                # Word shouldn't contain numbers or special chars (except hyphens)
                if re.search(r'[0-9@#$%^&*()+=\[\]{}|\\/<>]', w):
                    is_valid_name = False
                    break

            if is_valid_name:
                print(f"[DEBUG] Name found via positional heuristic: {line}")
                return line

    # STRATEGY 2: Original first-chunk analysis
    first_chunk = lines[0] if lines else ""

    # Skip header lines
    if any(k == first_chunk.lower() for k in skip_keywords):
        first_chunk = lines[1] if len(lines) > 1 else ""

    words = first_chunk.split()
    possible_name = []

    for word in words:
        if any(title in word.lower() for title in job_title_keywords):
            break
        if '@' in word or re.search(r'\d', word) or '|' in word:
            break

        if word and (word[0].isupper() or word.lower() in name_connectors):
            possible_name.append(word)
        elif possible_name:
            break

    if 2 <= len(possible_name) <= 5:
        return ' '.join(possible_name)

    # STRATEGY 3: Merge single-word capitalized lines
    merged_name = []
    for line in lines[:4]:
        if not line:
            continue
        if ' ' not in line and line[0].isupper() and not any(k in line.lower() for k in skip_keywords):
            merged_name.append(line)
        else:
            break

    if 2 <= len(merged_name) <= 4:
        return ' '.join(merged_name)

    # STRATEGY 4: Last resort - first reasonable line
    if lines:
        first_line = lines[0]
        if 3 < len(first_line) < 30 and not any(k in first_line.lower() for k in skip_keywords):
            return first_line

    return None


def extract_skills(text: str) -> List[str]:
    """Extract skills from text using exact and fuzzy matching."""
    text_lower = text.lower()
    found_skills = set()

    # Skills that should keep special casing
    special_case_skills = {'c#', 'c++', '.net', 'ci/cd', 'ui/ux', 'nlp'}
    # Skills that need special matching (contain non-word chars)
    special_pattern_skills = {'c#', 'c++', '.net', 'ci/cd', 'ui/ux', 'node.js'}

    def format_skill(skill: str) -> str:
        """Format skill with proper casing."""
        if skill.lower() in special_case_skills:
            return skill.upper() if skill.lower() in {'nlp'} else skill
        return skill.title()

    # 1. Check aliases first (exact match on common abbreviations)
    words = re.findall(r'[a-z0-9#+./-]+', text_lower)
    for word in words:
        if word in SKILL_ALIASES:
            canonical = SKILL_ALIASES[word]
            found_skills.add(format_skill(canonical))

    # 2. Handle special pattern skills (c#, c++, .net, etc.) with direct search
    for skill in special_pattern_skills:
        if skill.lower() in text_lower:
            found_skills.add(format_skill(skill))

    # 3. Exact matches using word boundaries (fast path)
    for skill in SKILLS_LIST:
        if skill in special_pattern_skills:
            continue  # Already handled above
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.add(format_skill(skill))

    # 4. Fuzzy matching for typos (only for words not already matched)
    matched_words = set()
    for skill in found_skills:
        matched_words.update(skill.lower().split())

    for word in words:
        # Skip if already matched, too short, or looks like noise
        if len(word) < 4 or word in matched_words:
            continue
        if word.isdigit() or re.match(r'^[0-9./-]+$', word):
            continue

        # Try fuzzy match against skills list
        match = process.extractOne(
            word,
            SKILLS_LIST,
            scorer=fuzz.ratio,
            score_cutoff=85  # Conservative threshold to avoid false positives
        )
        if match:
            skill = match[0]
            found_skills.add(format_skill(skill))
            print(f"[DEBUG] Fuzzy matched '{word}' -> '{skill}' (score: {match[1]})")

    return list(found_skills)


def extract_experience_years(text: str) -> Optional[int]:
    """Extract years of experience from text."""
    # Look for patterns like "5 years experience", "5+ years", "5-7 years"
    patterns = [
        r'(\d+)\+?\s*years?\s*(?:of)?\s*experience',
        r'experience\s*[:.]?\s*(\d+)\+?\s*years?',
        r'(\d+)-\d+\s*years?\s*(?:of)?\s*experience'
    ]

    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            return int(match.group(1))

    return None


def extract_education(text: str) -> List[str]:
    """Extract education information from text - finds full degree descriptions."""
    text_lower = text.lower()
    
    # More robust patterns to capture the full line including "Bachelor of X in Y"
    degree_patterns = [
        # Pattern 1: Bachelor's Degree in X, University of Y
        # Handles smart quotes (’) and straight quotes (')
        # Allows commas in the middle (for "Database Systems, Bahrain Polytechnic")
        # Added 'polytechnic' to institution list
        r"(?:(?:bachelor|master|doctor)(?:['’]?s?)?|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|mba|ph\.?d\.?)\s+(?:degree\s+)?(?:of|in)?\s+[\w\s&,-]+(?:university|college|institute|school|polytechnic)[\w\s,-]*",
        
        # Pattern 2: Bachelor's Degree in X (without explicit university keyword)
        r"(?:bachelor|master|doctor)(?:['’]?s?)?\s+(?:degree\s+)?(?:of|in)\s+[\w\s&,-]+",
        
        # Pattern 3: B.S. in X
        r"(?:b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?)\s+in\s+[\w\s&,-]+",
    ]
    
    degrees = []
    
    # 1. Try regex patterns on the whole text
    for pattern in degree_patterns:
        matches = re.finditer(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            # Get original text case if possible, but we are searching lower
            # We'll just capitalize the match result
            match_text = text[match.start():match.end()].strip()
            
            # Filter out false positives that are too long or too short
            if 10 < len(match_text) < 100:
                 # Clean up newlines in the match
                clean_match = re.sub(r'\s+', ' ', match_text)
                degrees.append(clean_match)
    
    # 2. Fallback: Line-based search (especially after normalization provided structure)
    if not degrees:
        lines = text.split('\n')
        degree_keywords = ['bachelor', 'master', 'phd', 'doctorate', 'bsc', 'msc', 'mba', 'degree in']
        
        for line in lines:
            line_clean = line.strip()
            line_lower = line_clean.lower()
            
            if len(line_clean) < 10 or len(line_clean) > 150:
                continue
                
            if any(k in line_lower for k in degree_keywords):
                # Avoid headers like "Education" alone
                if line_lower in ['education', 'education history', 'academic background']:
                    continue
                degrees.append(line_clean)
    
    # Remove duplicates with fuzzy matching
    # if one string is contained in another, keep the longer one
    # if they are very similar, keep one
    
    unique_degrees = []
    # Sort by length descending to prioritize longer descriptions
    degrees.sort(key=len, reverse=True)
    
    for d in degrees:
        is_duplicate = False
        d_lower = d.lower()
        
        for unique in unique_degrees:
            unique_lower = unique.lower()
            
            # Check for substring match
            if d_lower in unique_lower:
                is_duplicate = True
                break
            
            # Check for high similarity (if one is just slightly different)
            # Simple Jaccard similarity on words
            d_words = set(d_lower.split())
            u_words = set(unique_lower.split())
            intersection = d_words.intersection(u_words)
            if not d_words or not u_words: continue
            
            similarity = len(intersection) / len(u_words)
            if similarity > 0.6: # If 60% of words in the new entry are already in an existing entry
                 is_duplicate = True
                 break

        if not is_duplicate:
            unique_degrees.append(d)
    
    return unique_degrees[:3]


def parse_cv_text(text: str) -> Dict[str, Any]:
    """Parse CV text and extract structured information."""
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "experience_years": extract_experience_years(text),
        "education": extract_education(text),
        "raw_text": text[:500]  # First 500 chars for debugging
    }


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "HRFlow CV Parser",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/parse")
async def parse_cv(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None)
):
    """
    Parse a CV from uploaded file or URL.

    Supports PDF and DOCX files.
    Extracts: name, email, phone, skills, experience, education.
    """
    if not file and not url:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'url' must be provided"
        )

    # Handle file upload
    if file:
        filename = file.filename.lower() if file.filename else ""

        # Validate file type
        if not (filename.endswith('.pdf') or filename.endswith('.docx')):
            raise HTTPException(
                status_code=400,
                detail="Only PDF and DOCX files are supported"
            )

        # Read file content
        content = await file.read()

        # Extract text based on file type
        if filename.endswith('.pdf'):
            text = extract_text_from_pdf(content)
        else:  # .docx
            text = extract_text_from_docx(content)

        # Parse extracted text
        parsed_data = parse_cv_text(text)
        
        # Debug: Print parsed data
        print(f"\n{'='*50}")
        print(f"[CV Parser] Parsed CV: {file.filename}")
        print(f"  Name: {parsed_data.get('name')}")
        print(f"  Email: {parsed_data.get('email')}")
        print(f"  Phone: {parsed_data.get('phone')}")
        print(f"  Skills: {len(parsed_data.get('skills', []))} found")
        print(f"  Education: {parsed_data.get('education')}")
        print(f"{'='*50}\n")

        return {
            "success": True,
            "source": "file",
            "filename": file.filename,
            "data": parsed_data
        }

    # Handle URL (placeholder for now - would need requests library)
    if url:
        raise HTTPException(
            status_code=501,
            detail="URL parsing not yet implemented. Please upload file directly."
        )


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/k8s."""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
