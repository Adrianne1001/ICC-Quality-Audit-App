# Infosoft Quality Audit Agent

```bash
# Configuration variables reused across setup and deployment commands
PROJECT_ID="infosoft-quality-audit-app"
SERVICE_NAME="infosoft-quality-audit-app"
REGION="asia-east1"
```

---

## 1. Overview, Architecture, Features & Threat Model Summary

### Overview
**Infosoft Quality Audit Agent** is an enterprise Total Quality Management (TQM) process audit platform tailored for Infosoft. The application conducts structured, AI-guided quality audit interviews with employees across departments, isolates findings by authenticated user, cross-references corporate SOP standards and extracted audit areas, and delivers an executive Pareto analysis along with consolidated audit intelligence to the super administrator.

### Architecture Overview

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons, SafeMarkdown | Responsive corporate UI, SVG Pareto chart, 6-stage interview progression indicator, review modals, and error toasts with retry actions. |
| **Backend & Routing** | Express.js, Node.js / `tsx` | Unified full-stack server running Vite middleware in development and serving compiled assets in production. Defensive payload ingestion, null-safe destructuring, and ordered middleware. |
| **AI Engine** | Gemini 3.6 Flash via `@google/genai` | Multi-turn function-calling loop with server-enforced tool execution, resilient model fallback ladder (`gemini-3.6-flash` $\rightarrow$ `gemini-3.1-flash-lite` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.7-flash`), baseline document parsing, and audit synthesis. |
| **Database & Security** | Cloud Firestore (`ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1`) | Hardened security rules with strict user data isolation, collection-group admin read-only access, schema validation on findings, and zero insecure defaults. |
| **Authentication** | Firebase Authentication | Google SSO identity verification without storing emails or passwords in application code. |
| **Secrets & Config** | Google Cloud Secret Manager / Env Vars | Server-side credential isolation (`GEMINI_API_KEY`), environment variable configuration (`ADMIN_EMAIL`, `FORCE_MODEL_FAILURE`). |

### Feature List
- **Structured Audit Interviews**: 6-stage progressive interview pipeline (Introduction $\rightarrow$ Process Walkthrough $\rightarrow$ Pain Points & Bottlenecks $\rightarrow$ Quality & Compliance Check $\rightarrow$ Tooling & Resource Review $\rightarrow$ Summary & Sign-off).
- **Ishikawa Root-Cause Categorization**: Findings classified under 6M categories (*Man*, *Machine*, *Method*, *Material*, *Measurement*, *Environment*) with four severity tiers (*Low*, *Medium*, *High*, *Critical*).
- **Employee Finding Review & Dispute**: Portal allowing employees to confirm, edit, or dispute audit findings before finalization.
- **Session History & Chat Transcripts**: Multi-session audit management with preserved transcripts isolated to the owning employee.
- **Admin Baseline Knowledge Management**: Super admin capability to upload corporate SOPs, quality policies, and compliance manuals (`.pdf`, `.txt`, `.md` up to 5 MB) parsed by Gemini into active audit areas.
- **Consolidated Audit Intelligence & Pareto Analysis**: Super admin dashboard aggregating findings across all users, rendering dynamic SVG Pareto charts, category breakdown statistics, and generating executive audit reports.

### Threat Model Summary (Production Directives)

| Threat Zone | Risk Vector | Countermeasure Implemented |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious file payloads, oversized uploads, script injection | Strict file extension enforcement (`.pdf`, `.txt`, `.md`), 5 MB file size limit, chat messages capped at 2,000 characters, schema validation on all API endpoints. |
| **Planning & Reasoning** | Prompt injection via untrusted baseline SOPs or employee chats | Uploaded documents and baseline context wrapped in delimited boundary markers (`<<<COMPANY_BASELINE_CONTEXT>>>`) and treated strictly as inert data; system prompt explicitly forbids following instructions embedded in documents. |
| **Tool Execution** | Privilege escalation via model function calls, arbitrary data mutation | Function calling executes server-side only in a bounded loop (max 4 rounds). `userId` is strictly anchored to the verified Firebase Auth token (`req.user.uid`), never accepted from model arguments or client bodies. Strict enum and length validation on all tool arguments. |
| **Memory & State** | Cross-user data leaks, unauthorized access | User data strictly partitioned under `/users/{userId}/**`. `firestore.rules` enforces `request.auth.uid == userId`. Admin access is read-only via collection groups and guarded by server token validation and `/admins/{uid}` presence. |
| **Inter-System Communication** | Token leakage, upstream API downtime | `GEMINI_API_KEY` accessed only on the server. Automated 4-tier model fallback ladder with exponential backoff for recoverable HTTP codes (503, 429, 404, 500). Server invokes Firestore REST API using the client's verified Bearer token, preserving rules enforcement without granting broad IAM privileges to the service account. |

---

## 2. Prerequisites

1. **Install CLI Tools**:
   - Install the [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install).
   - Install the [Firebase CLI](https://firebase.google.com/docs/cli):
     ```bash
     npm install -g firebase-tools
     ```

2. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   ```

3. **Set the Target Google Cloud Project**:
   ```bash
   gcloud config set project $PROJECT_ID
   ```

4. **Enable Required Google Cloud Services**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     identitytoolkit.googleapis.com \
     cloudbuild.googleapis.com \
     artifactregistry.googleapis.com \
     --project=$PROJECT_ID
   ```

---

## 3. Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `APP_URL`: `http://localhost:3000` (or your local development URL).
   - `ADMIN_EMAIL`: `abasuel_250000002102@uic.edu.ph`
   - `FORCE_MODEL_FAILURE`: `false`

   > **CRITICAL SECURITY NOTE**: The `.env` file is git-ignored and contains local secrets. It **must never be committed** to version control.

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Secret Manager Configuration

The application requires `GEMINI_API_KEY` for server-side AI processing. At runtime, the server code reads `process.env.GEMINI_API_KEY`. Cloud Run automatically mounts and injects this environment variable from Google Cloud Secret Manager.

`ADMIN_EMAIL` is not a secret or credential; it is an administrative policy identifier and is configured as a standard environment variable.

1. **Create and Populate the Secret**:
   ```bash
   gcloud secrets create GEMINI_API_KEY \
     --replication-policy="automatic" \
     --project=$PROJECT_ID

   echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY \
     --data-file=- \
     --project=$PROJECT_ID
   ```

2. **Grant Secret Accessor IAM Role to Cloud Run Runtime Service Account**:
   Grant `roles/secretmanager.secretAccessor` to the Cloud Run compute service account (`888649772704-compute@developer.gserviceaccount.com`):
   ```bash
   gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
     --member="serviceAccount:888649772704-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=$PROJECT_ID
   ```

---

## 5. Cloud Firestore Configuration

### Named Database Note
The project uses the named database **`ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1`** (not `(default)`).

For a fresh project requiring a new named database, create it using `gcloud`:
```bash
gcloud firestore databases create \
  --database=ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1 \
  --location=$REGION \
  --type=firestore-native \
  --project=$PROJECT_ID
```

### Deploying Rules & Indexes via Firebase CLI
To deploy rules and indexes to the named database using the Firebase CLI, target the named database in your `firebase.json` configuration block:

```json
{
  "firestore": {
    "database": "ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Deploy both the security rules and the composite indexes:
```bash
firebase deploy --only firestore:rules,firestore:indexes --project=$PROJECT_ID
```

### Current Production Security Rules (`firestore.rules`)
> **Source of Truth**: The `firestore.rules` file in the root of this repository is the definitive source of truth. Below is the exact, verbatim ruleset including the findings create/update validation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Default deny all access
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    function isValidId(id) {
      return id is string && id.size() > 0 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    // Admins collection: a user may only get their own document to check their admin status; no client writes allowed
    match /admins/{adminId} {
      allow get: if isSignedIn() && isValidId(adminId) && request.auth.uid == adminId;
      allow list, write: if false;
    }

    // User profile and subcollections: owner read/write, admin read-only
    match /users/{userId} {
      allow get: if isValidId(userId) && (isOwner(userId) || isAdmin());
      allow list: if isAdmin();
      allow create, update: if isValidId(userId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
      allow delete: if isValidId(userId) && isOwner(userId);

      // Sessions
      match /sessions/{sessionId} {
        allow get: if isValidId(userId) && isValidId(sessionId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create, update: if isValidId(userId) && isValidId(sessionId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
        allow delete: if isValidId(userId) && isValidId(sessionId) && isOwner(userId);
      }

      // Interactions (chat transcript)
      match /interactions/{interactionId} {
        allow get: if isValidId(userId) && isValidId(interactionId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create, update: if isValidId(userId) && isValidId(interactionId) && isOwner(userId) && request.resource.data.userId == request.auth.uid;
        allow delete: if isValidId(userId) && isValidId(interactionId) && isOwner(userId);
      }

      // Findings
      match /findings/{findingId} {
        allow get: if isValidId(userId) && isValidId(findingId) && (isOwner(userId) || isAdmin());
        allow list: if isValidId(userId) && (isOwner(userId) || isAdmin());
        allow create: if isValidId(userId) && isValidId(findingId) && isOwner(userId)
          && request.resource.data.userId == request.auth.uid
          && request.resource.data.status == 'Pending'
          && request.resource.data.ishikawaCategory in ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment']
          && request.resource.data.severity in ['Low', 'Medium', 'High', 'Critical']
          && isValidId(request.resource.data.sessionId)
          && exists(/databases/$(database)/documents/users/$(userId)/sessions/$(request.resource.data.sessionId))
          && request.resource.data.description is string && request.resource.data.description.size() <= 2000
          && request.resource.data.userQuote is string && request.resource.data.userQuote.size() <= 2000
          && request.resource.data.suggestedImprovement is string && request.resource.data.suggestedImprovement.size() <= 2000;
        allow update: if isValidId(userId) && isValidId(findingId) && isOwner(userId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(
            ['status', 'description', 'suggestedImprovement', 'userEditNote', 'userDisputeReason', 'updatedAt']
          )
          && request.resource.data.status in ['Confirmed', 'Edited', 'Disputed'];
        allow delete: if isValidId(userId) && isValidId(findingId) && isOwner(userId);
      }
    }

    // Collection group queries for Super Admin consolidated view
    match /{path=**}/findings/{findingId} {
      allow read: if isAdmin();
    }
    match /{path=**}/sessions/{sessionId} {
      allow read: if isAdmin();
    }
    match /{path=**}/interactions/{interactionId} {
      allow read: if isAdmin();
    }

    // Company Baseline documents: Super Admin only
    match /companyBaseline/{baselineId} {
      allow get, write: if isValidId(baselineId) && isAdmin();
      allow list: if isAdmin();
    }

    // Audit Areas: All signed-in users can read active areas (isActive == true); Admin can read/write all
    match /auditAreas/{areaId} {
      allow get: if isValidId(areaId) && isSignedIn() && (resource.data.isActive == true || isAdmin());
      allow list: if isSignedIn() && (resource.data.isActive == true || isAdmin());
      allow write: if isValidId(areaId) && isAdmin();
    }

    // Audit Reports: Super Admin only
    match /auditReports/{reportId} {
      allow get, write: if isValidId(reportId) && isAdmin();
      allow list: if isAdmin();
    }
  }
}
```

---

## 6. Super Administrator Configuration

Administrative privileges follow a strict **dual-verification, fail-closed architecture** (Directive 8). Both checks are mandatory:

1. **Server-Side Identity Verification**:
   The verified email from the Firebase Auth ID token must match the `ADMIN_EMAIL` environment variable (`abasuel_250000002102@uic.edu.ph`, compared case-insensitively). If `ADMIN_EMAIL` is empty or unset, admin privileges fail closed for all users.
2. **Database Role Document**:
   The document `/admins/{uid}` must exist in the named database `ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1` with the field `role: "superadmin"`.

### Provisioning the Super Admin Document
Because `firestore.rules` enforces `allow write: if false;` on `/admins`, **the application code can never create or edit `/admins` documents**. The document must be manually created once by the project owner in the Firebase Console:

1. Sign in to the application as `abasuel_250000002102@uic.edu.ph` via Google Sign-In.
2. The UI will detect that the email matches `ADMIN_EMAIL` but the database document is missing, displaying the amber **Admin Setup Notice** banner with your unique Firebase User ID (`UID`).
3. Open the [Firebase Console](https://console.firebase.google.com/) $\rightarrow$ **Firestore Database** $\rightarrow$ Select database **`ai-studio-5e3aef77-f922-468f-aacf-28d545eecaa1`**.
4. Click **Start collection**:
   - Collection ID: `admins`
   - Document ID: `<SUPER_ADMIN_UID>` (copy your exact UID from the in-app notice)
   - Field: `role` | Type: `string` | Value: `superadmin`
5. Click **Verify Admin Access** in the application banner. The super administrator interface and consolidated audit tabs will immediately activate.

---

## 7. Cloud Run Deployment

### Source Deployment
Deploy directly to Google Cloud Run from source. Cloud Run builds the container, mounts the Secret Manager secret, and injects runtime environment variables:

```bash
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars ADMIN_EMAIL="abasuel_250000002102@uic.edu.ph",NODE_ENV=production \
  --project=$PROJECT_ID
```

> **IMPORTANT**:
> - **Never** set `FORCE_MODEL_FAILURE` in production.
> - `tsx` is listed under `dependencies` (not `devDependencies`) in `package.json`, ensuring that `npm start` (`tsx server.ts`) executes reliably in containerized environments when build packs prune development dependencies after `npm run build`.

### Updating an Existing Service (e.g., Published from AI Studio)
If the application was previously published from AI Studio, update the existing Cloud Run service to reference the Secret Manager secret and configure `ADMIN_EMAIL`:

1. **Remove plain environment variable** (if a plain `GEMINI_API_KEY` was previously set):
   ```bash
   gcloud run services update $SERVICE_NAME \
     --remove-env-vars GEMINI_API_KEY \
     --region=$REGION \
     --project=$PROJECT_ID
   ```

2. **Mount the Secret Manager secret and set environment variables**:
   ```bash
   gcloud run services update $SERVICE_NAME \
     --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
     --set-env-vars ADMIN_EMAIL="abasuel_250000002102@uic.edu.ph",NODE_ENV=production \
     --region=$REGION \
     --project=$PROJECT_ID
   ```

---

## 8. Post-Deployment Verification

1. **Authorize Cloud Run Domain in Firebase Authentication**:
   - Retrieve your Cloud Run service URL:
     ```bash
     gcloud run services describe $SERVICE_NAME \
       --region=$REGION \
       --project=$PROJECT_ID \
       --format='value(status.url)'
     ```
   - Extract the domain (e.g., `infosoft-quality-audit-app-xyz.a.run.app`).
   - Open **Firebase Console** $\rightarrow$ **Authentication** $\rightarrow$ **Settings** $\rightarrow$ **Authorized domains**.
   - Click **Add domain** and paste your Cloud Run domain.
   > **Note**: Google Sign-In will fail with an `auth/unauthorized-domain` error if this step is omitted.

2. **Apply Campaign Challenge Label**:
   Apply the required campaign label to register the service for automated verification:
   ```bash
   gcloud run services update $SERVICE_NAME \
     --update-labels=dev-tutorial=cloud-run-ai-challenge \
     --region=$REGION \
     --project=$PROJECT_ID
   ```

3. **Verify Challenge Label**:
   Confirm that the label is present on the live Cloud Run deployment:
   ```bash
   gcloud run services describe $SERVICE_NAME \
     --region=$REGION \
     --project=$PROJECT_ID \
     --format='value(metadata.labels)'
   ```
   The output should contain:
   ```
   dev-tutorial=cloud-run-ai-challenge
   ```

---

## 9. Security Notes & Best Practices

1. **Firebase Web API Key Hygiene**:
   - The `apiKey` located in `firebase-applet-config.json` is a public client identifier used to route requests to the Firebase project, not a secret credential.
   - When restricting this key in Google Cloud Console (**APIs & Services** $\rightarrow$ **Credentials**):
     - Restrict by **API Restrictions only** (e.g., Identity Toolkit API, Token Service API).
     - **DO NOT** restrict by HTTP Referrer. The backend server invokes the Google Identity Toolkit REST endpoint (`accounts:lookup`) directly to verify user tokens without passing browser referrer headers. Restricting by HTTP referrer will break server-side token authentication.

2. **Server-Side REST Authentication Model**:
   - The server code forwards the client's verified Bearer ID token directly in the `Authorization` header when querying Firestore via REST (`https://firestore.googleapis.com/v1/projects/.../databases/.../documents`).
   - Consequently, **all Firestore security rules apply to server-initiated requests** exactly as they would to client requests.
   - The Cloud Run compute service account does **not** require broad Firestore IAM roles (such as `roles/datastore.user` or `roles/datastore.owner`), upholding the principle of least privilege.

3. **Known Security Boundaries & Limits**:
   - While finding creation and updates are validated for field presence, enum conformity, and length limits, an authenticated user can create well-formed findings within their own audit session.
   - Session documents (`/users/{userId}/sessions/{sessionId}`) and interaction transcripts (`/users/{userId}/interactions/{interactionId}`) remain owner-writable to allow real-time transcript streaming and state tracking.

---

## 10. Model Fallback Test Switch (`FORCE_MODEL_FAILURE`)

To facilitate end-to-end testing of the Resilient Model Fallback Ladder (Directive 6) without waiting for upstream API outages:

```bash
# Enable simulated primary model failure (local testing only)
export FORCE_MODEL_FAILURE="true"
```

When active, the primary model (`gemini-3.6-flash`) returns a simulated `503 UNAVAILABLE` error, prompting the server fallback mechanism to step down the ladder:
```text
[Startup] FORCE_MODEL_FAILURE is ON
[fallback] Pass 1/3 starting ladder execution...
[fallback] Pass 1: gemini-3.6-flash failed (503 UNAVAILABLE [FORCE_MODEL_FAILURE]) -> trying gemini-3.1-flash-lite
[fallback] Pass 1: gemini-3.1-flash-lite answered successfully
```

> **PRODUCTION SAFEGUARD**: `FORCE_MODEL_FAILURE` is strictly intended for local testing. It must remain unset or set to `false` in production environments.
