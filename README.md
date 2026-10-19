# Infosoft Quality Audit Agent

An enterprise Total Quality Management (TQM) process audit platform for Infosoft. The application conducts structured AI-driven quality audit interviews with employees across departments, isolates findings by user, cross-references internal SOP standards, and delivers executive Pareto analysis and consolidated audit intelligence to the super administrator.

---

## Architecture Overview

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide Icons | Responsive corporate UI, SVG Pareto chart, 6-stage interview indicator, in-app modals. |
| **Backend & Routing** | Express.js, Node.js / tsx | Unified full-stack server running Vite in development and serving production assets. |
| **AI Engine** | Gemini 3.6 Flash via `@google/genai` | Autonomous function calling loop, resilient model fallback ladder, baseline extraction, and report synthesis. |
| **Database & Security** | Cloud Firestore | Hardened rules with strict user data isolation, collection-group admin access, and zero insecure defaults. |
| **Authentication** | Firebase Authentication | Google SSO identity verification without storing emails or passwords in application code. |
| **Secrets & Config** | Google Cloud Secret Manager / Env Vars | Server-side credential isolation (`GEMINI_API_KEY`, `ADMIN_EMAIL`, `FORCE_MODEL_FAILURE`). |

---

## Threat Model Summary (Production Directives)

| Threat Zone | Risk Vector | Countermeasure Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious file payloads / oversized uploads | Strict file extension validation (`.pdf`, `.txt`, `.md`) and 5 MB ceiling. Chat input capped at 2,000 characters. |
| **Planning & Reasoning** | Prompt injection in company baseline | All uploaded documents wrapped in clearly delimited contextual boundary markers (`<<<DATA>>>`) and treated strictly as inert data. |
| **Tool Execution** | Privilege escalation via function calls | `userId` is strictly bound to the verified Firebase Auth token (`req.user.uid`). Model cannot supply target UIDs. |
| **Memory & State** | Cross-user data leakage | User data strictly partitioned under `/users/{userId}/**`. `firestore.rules` enforces `request.auth.uid == userId`. |
| **Inter-System Communication** | API token leakage & availability drops | Gemini API key accessed only server-side. Multi-tier model fallback ladder (`gemini-3.6-flash` $\rightarrow$ `gemini-3.1-flash-lite` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.7-flash`). |

---

## 1. Prerequisites & Google Cloud Services

Enable required Google Cloud APIs:
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Secret Management Setup

Create the `GEMINI_API_KEY` secret in Google Cloud Secret Manager and grant access to the Cloud Run compute service account:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the Cloud Run default service account permission to read the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Cloud Firestore Security Configuration

### Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() { return request.auth != null; }
    function isOwner(userId) { return isSignedIn() && request.auth.uid == userId; }
    function isAdmin() { return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }
    function isValidId(id) { return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$'); }

    match /admins/{adminId} {
      allow get: if isSignedIn() && isValidId(adminId) && request.auth.uid == adminId;
      allow list, write: if false;
    }

    match /users/{userId} {
      allow get: if isValidId(userId) && (isOwner(userId) || isAdmin());
      allow list: if isAdmin();
      allow create, update: if isValidId(userId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
      allow delete: if isValidId(userId) && isOwner(userId);

      match /sessions/{sessionId} {
        allow get: if isValidId(userId) && isValidId(sessionId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create, update: if isValidId(userId) && isValidId(sessionId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
        allow delete: if isValidId(userId) && isValidId(sessionId) && isOwner(userId);
      }

      match /interactions/{interactionId} {
        allow get: if isValidId(userId) && isValidId(interactionId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create, update: if isValidId(userId) && isValidId(interactionId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
        allow delete: if isValidId(userId) && isValidId(interactionId) && isOwner(userId);
      }

      match /findings/{findingId} {
        allow get: if isValidId(userId) && isValidId(findingId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create, update: if isValidId(userId) && isValidId(findingId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
        allow delete: if isValidId(userId) && isValidId(findingId) && isOwner(userId);
      }
    }

    match /{path=**}/findings/{findingId} { allow read: if isAdmin(); }
    match /{path=**}/sessions/{sessionId} { allow read: if isAdmin(); }
    match /{path=**}/interactions/{interactionId} { allow read: if isAdmin(); }

    match /companyBaseline/{baselineId} {
      allow read, write: if isValidId(baselineId) && isAdmin();
    }

    match /auditAreas/{areaId} {
      allow get: if isValidId(areaId) && isSignedIn() && (resource.data.isActive == true || isAdmin());
      allow list: if isSignedIn() && (resource.data.isActive == true || isAdmin());
      allow write: if isValidId(areaId) && isAdmin();
    }

    match /auditReports/{reportId} {
      allow read, write: if isValidId(reportId) && isAdmin();
    }
  }
}
```

---

## 4. Super Administrator Configuration

Per Directive 8, administrative rights are strictly fail-closed:
1. Set the `ADMIN_EMAIL` environment variable:
   ```bash
   ADMIN_EMAIL="abasuel_250000002102@uic.edu.ph"
   ```
2. In the Firebase Console, create the single role document by hand:
   - Collection: `admins`
   - Document ID: `<SUPER_ADMIN_UID>` (displayed in the app banner upon Google Sign-In)
   - Field: `role: "superadmin"`

---

## 5. Google Cloud Run Deployment Flow

Build and deploy the application container to Cloud Run:

```bash
# Build the production assets
npm run build

# Deploy to Cloud Run mounting the Secret Manager secret
gcloud run deploy infosoft-quality-audit-app \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars ADMIN_EMAIL="abasuel_250000002102@uic.edu.ph",FORCE_MODEL_FAILURE="false" \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## 6. Required Campaign Verification Binding

Apply the mandatory challenge resource label to register the Cloud Run deployment for automated verification:

```bash
gcloud run services update infosoft-quality-audit-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-east1
```

---

## 7. Model Fallback Test Switch

To test the automated fallback ladder without waiting for external API outages:
```bash
# Enable simulated primary model failure
export FORCE_MODEL_FAILURE="true"

# When active, server logs will record:
# [fallback] gemini-3.6-flash failed (503 UNAVAILABLE [FORCE_MODEL_FAILURE]) -> trying gemini-3.1-flash-lite
# [fallback] gemini-3.1-flash-lite answered successfully
```
