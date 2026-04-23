"""
Tests for CV parsing improvements.
Run with: python -m pytest test_parsing_logic.py -v
Or simply: python test_parsing_logic.py
"""

import sys
from main import extract_skills, extract_name, extract_education


class TestFuzzySkillMatching:
    """Test fuzzy matching for skills with typos and variations."""

    def test_exact_skill_match(self):
        """Test that exact skill names are matched."""
        text = "Experienced in Python, JavaScript, and Docker"
        skills = extract_skills(text)
        assert 'Python' in skills
        assert 'Javascript' in skills
        assert 'Docker' in skills

    def test_fuzzy_skill_typos(self):
        """Test that common typos are caught via fuzzy matching."""
        text = "Skills: Pythn, Javascrpt, Kuberntes"
        skills = extract_skills(text)
        # These should be fuzzy matched with score >= 85
        assert 'Python' in skills
        assert 'Javascript' in skills
        assert 'Kubernetes' in skills

    def test_skill_aliases(self):
        """Test that skill aliases are recognized."""
        text = "Proficient in JS, TS, k8s, and py"
        skills = extract_skills(text)
        assert 'Javascript' in skills
        assert 'Typescript' in skills
        assert 'Kubernetes' in skills
        assert 'Python' in skills

    def test_react_variations(self):
        """Test React and its variations."""
        text = "Built applications with ReactJS and react.js frameworks"
        skills = extract_skills(text)
        assert 'React' in skills

    def test_special_case_skills(self):
        """Test skills with special characters preserve casing."""
        text = "Experience with C#, C++, .NET framework, and CI/CD pipelines"
        skills = extract_skills(text)
        skills_lower = [s.lower() for s in skills]
        # These should be found (case-insensitive check)
        assert 'c#' in skills_lower
        assert 'c++' in skills_lower
        assert '.net' in skills_lower

    def test_no_false_positives(self):
        """Test that unrelated words don't fuzzy match to skills."""
        text = "I enjoy playing guitar and reading books about history"
        skills = extract_skills(text)
        # Should not match any skills
        assert len(skills) == 0

    def test_expanded_skills_list(self):
        """Test newly added skills are recognized."""
        text = "Tech stack: Redis, Kafka, TensorFlow, PyTorch, Django"
        skills = extract_skills(text)
        assert 'Redis' in skills
        assert 'Kafka' in skills
        assert 'Tensorflow' in skills
        assert 'Pytorch' in skills
        assert 'Django' in skills


class TestNameExtraction:
    """Test name extraction with positional heuristics."""

    def test_name_before_email(self):
        """Test name extraction when it appears before email."""
        text = "John Smith\njohn.smith@email.com\n+1234567890"
        name = extract_name(text)
        assert name == "John Smith"

    def test_name_before_phone(self):
        """Test name extraction when it appears before phone."""
        text = "Jane Doe\n+1 555-123-4567\nSoftware Engineer"
        name = extract_name(text)
        assert name == "Jane Doe"

    def test_name_with_job_title(self):
        """Test that job titles are excluded from name."""
        text = "Michael Johnson\nSenior Software Engineer\nmike@company.com"
        name = extract_name(text)
        assert name == "Michael Johnson"
        assert "Engineer" not in name

    def test_arabic_name_connectors(self):
        """Test names with Arabic connectors like 'bin', 'al'."""
        text = "Ahmed bin Khalid Al Rashid\nahmed@email.com"
        name = extract_name(text)
        assert "Ahmed" in name
        assert "bin" in name.lower() or "Bin" in name

    def test_european_name_connectors(self):
        """Test names with European connectors like 'van', 'de'."""
        text = "Ludwig van Beethoven\nluwig@music.com"
        name = extract_name(text)
        assert "Ludwig" in name
        assert "van" in name.lower()

    def test_skip_resume_header(self):
        """Test that 'RESUME' header is skipped."""
        text = "RESUME\nSarah Connor\nsarah@email.com"
        name = extract_name(text)
        assert name == "Sarah Connor"
        assert "RESUME" not in name

    def test_skip_cv_header(self):
        """Test that 'Curriculum Vitae' is skipped."""
        text = "Curriculum Vitae\nDavid Chen\ndavid@email.com"
        name = extract_name(text)
        assert "David" in name
        assert "Curriculum" not in name

    def test_pipe_separated_format(self):
        """Test name extraction from pipe-separated CV format."""
        text = "Robert Williams | robert@email.com | +1 555-000-1234"
        name = extract_name(text)
        assert "Robert" in name
        assert "Williams" in name


class TestEducationExtraction:
    """Test education extraction."""

    def test_bachelors_degree(self):
        """Test Bachelor's degree extraction."""
        text = "Education: Bachelor's Degree in Computer Science, MIT"
        education = extract_education(text)
        assert len(education) > 0
        assert any("bachelor" in e.lower() for e in education)

    def test_masters_degree(self):
        """Test Master's degree extraction."""
        text = "Master of Science in Data Science from Stanford University"
        education = extract_education(text)
        assert len(education) > 0
        assert any("master" in e.lower() for e in education)

    def test_multiple_degrees(self):
        """Test extraction of multiple degrees."""
        text = """
        Education:
        Bachelor's Degree in Computer Science, University of California
        Master's Degree in Business Administration, Harvard Business School
        """
        education = extract_education(text)
        # Should find at least one education entry
        assert len(education) >= 1


def run_tests():
    """Run all tests manually without pytest."""
    passed = 0
    failed = 0
    errors = []

    test_classes = [TestFuzzySkillMatching, TestNameExtraction, TestEducationExtraction]

    for test_class in test_classes:
        instance = test_class()
        methods = [m for m in dir(instance) if m.startswith('test_')]

        print(f"\n{'='*60}")
        print(f"Running {test_class.__name__}")
        print('='*60)

        for method_name in methods:
            try:
                method = getattr(instance, method_name)
                method()
                print(f"  PASS: {method_name}")
                passed += 1
            except AssertionError as e:
                print(f"  FAIL: {method_name}")
                print(f"        {e}")
                failed += 1
                errors.append((test_class.__name__, method_name, str(e)))
            except Exception as e:
                print(f"  ERROR: {method_name}")
                print(f"         {e}")
                failed += 1
                errors.append((test_class.__name__, method_name, str(e)))

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed")
    print('='*60)

    if errors:
        print("\nFailures:")
        for cls, method, error in errors:
            print(f"  - {cls}.{method}: {error}")

    return failed == 0


if __name__ == "__main__":
    # Run tests manually
    success = run_tests()
    sys.exit(0 if success else 1)
