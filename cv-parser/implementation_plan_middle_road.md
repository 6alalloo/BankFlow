# CV Parser Improvement Plan: "The Middle Road"

This plan outlines the steps to improve the **HRFlow CV Parser** by adding **Positional Heuristics** and **Fuzzy Matching**. These changes will increase extraction accuracy without significantly increasing the system's resource footprint.

## Proposed Changes

### 📦 Dependencies

#### [MODIFY] requirements.txt

- Add `rapidfuzz==3.5.2` for efficient fuzzy string matching.

### 🧠 Logic Refinement

#### [MODIFY] main.py

**1. Dependency Setup**

- Import `rapidfuzz.process` and `rapidfuzz.fuzz`.
- Move the hardcoded `SKILLS_LIST` from `extract_skills` to a global constant for easier maintenance.

**2. Fuzzy Skill Extraction**

- Update `extract_skills` to split text into segments.
- Use `process.extractOne` to compare segments against the `SKILLS_LIST`.
- Benefits: Catches typos like "Pythn" or "ReactJS" without extra regex.

**3. Text Normalization with Indices**

- Update `normalize_text` to return a list of lines/segments along with their original indices.
- This allows the parser to know _where_ in the document a piece of information was found.

**4. Positional Heuristics for Name & Education**

- Update `parse_cv_text` to first identify the line number where **Contact Info** (Email/Phone) is located.
- Pass this index to `extract_name`.
- Modify `extract_name` to prioritize searching lines **above** the contact info (since names almost always appear before phone/email).
- Similarly, improve `extract_education` by looking for university keywords near specific section headers.

## Verification Plan

### Automated Tests

Since there are no existing automated tests in the `cv-parser` directory, I will add a new test script `test_parsing_logic.py` to verify the improvements.

- **Command**: `python -m pytest test_parsing_logic.py` (if pytest is installed) or simply `python test_parsing_logic.py`.
- **Test Cases**:
  - `test_fuzzy_skills`: Verify that "Pythn" and "ReactJS" are correctly extracted as "Python" and "React".
  - `test_positional_name`: Verify that a name is correctly identified when it appears directly above an email address.

### Manual Verification

1.  **Test Upload**: Use the HRFlow frontend to upload a CV with common typos in skills.
2.  **Log Inspection**: Monitor `cv_parser_debug.log` to ensure the new heuristic logic is being triggered correctly.
3.  **UI Check**: Verify that the "Parsed CV" card in the execution details page displays the fuzzy-corrected skills and correctly identified name.
