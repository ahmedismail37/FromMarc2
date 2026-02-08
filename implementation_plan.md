# Hiring Assistant Agent - Implementation Plan

## Objective
Develop an AI-powered agent to assist in the hiring process by parsing Job Descriptions (JD) and Curriculum Vitae (CVs), matching them, and facilitating a bias-free selection process.

## User Workflow
1. **JD Upload**: User uploads a Job Description file.
2. **Analysis**: System parses and extracts:
   - Qualifications
   - Skills
   - Experiences
3. **CV Upload**: User uploads multiple CVs.
4. **Candidate Analysis**: System extracts and separates:
   - **Personal Info**: (Anonymized initially)
   - **Professional Info**: Skills, qualifications, experience.
5. **Matching**: System compares Candidates vs. JD and calculates a matching percentage.
6. **Selection**:
   - User views list of candidates (w/ IDs/Aliases and % Match).
   - User selects candidates to interview.
   - System reveals full details for selected candidates.

## Technology Stack (Proposed)
- **Frontend**: React (Vite) + Vanilla CSS (for rich aesthetics and "Wow" factor).
- **Processing**: Browser-based parsing (if possible) or a simple backend.
  - *Note*: For robust parsing of PDF/Docx, a backend or serverless function is often best. However, for this prototype, we can use client-side libraries (`pdfjs-dist`, `mammoth`) to keep it simple and local-first.
- **AI/Logic**: 
  - We will need a way to perform the extraction. We can use a mock logic for the prototype or integrate an LLM API if you have a key.

## Next Steps
1. Initialize the Vite React project.
2. Create the UI for the "Agent" steps.
3. Implement file parsing logic.
4. Implement the matching algorithm (placeholder or basic keyword matching initially).

---
**Question for User**:
- Would you like to proceed with this **Web Application** approach?
- Do you have an API Key (e.g., Gemini, OpenAI) we can use for the "Intelligence" part, or should we use basic keyword matching/mocking for now?
