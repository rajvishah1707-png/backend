# Application-linked supporting documents

Deploy both frontend and backend changes together. No new provider API key or environment variable is required. The existing MongoDB connection stores new private document bytes (maximum 5 MB per file); monitor database storage quota.

## Citizen flow

1. Select an active City Service and choose Apply.
2. For each required document, select an existing owned file or upload PDF/JPG/PNG directly in the form. The uploaded document starts Pending and is automatically selected.
3. Submit the application. The backend snapshots the service's required-document list and stores requirement-to-document references after checking ownership. It rejects missing requirements, rejected documents, missing legacy files and forged document IDs.
4. In My Applications → View Details → Application Documents, view/download linked files and read admin review remarks.
5. Before approval, use Add / Replace Documents to replace rejected files. Replacing documents does not automatically approve or resubmit a rejected application; the administrator must review it again.

## Admin flow

1. Admin Applications → Review Documents opens documents for that exact application.
2. View/Download files through authenticated requests. Verify a readable file or reject it with a reason.
3. All linked documents must be Verified before a new application can become Approved, In Progress or Completed. The existing payment checks still apply to completion.
4. Once approved, citizens cannot change the linked documents. Files used by submitted applications cannot be deleted. A file supporting an approved/in-progress/completed application cannot be rejected through the document endpoint without first reviewing the application status.

## Storage and legacy behavior

- New files live in MongoDB, are excluded from JSON metadata by schema selection/serialization, and are served only to the owner or an active administrator. Responses use private/no-store caching.
- Existing disk-backed file URLs remain supported. A disk file already lost from an older deployment cannot be recovered by this change; upload it again. The administrator cannot verify an unavailable old file.
- Legacy applications are labelled as legacy and are not silently linked to arbitrary identity documents. Pending/Under Review/Rejected legacy applications can be linked manually by their owner. When the original service ID is known, its current requirement list is used for that explicit linking action.
- Applications without the new document-flow marker retain their previous approval behavior until explicitly linked, avoiding invented historical requirements for completed records.
- New citizen applications snapshot requirements. Admin-created legacy-style applications without a service reference remain a manual review path.
- Metadata/file access tests use mocked models and local HTTP servers. Actual database persistence, browser file preview and deployment must still be checked with a test citizen/admin account.

## Demo verification

Upload and attach an identity file, submit, and open the exact application as admin. Attempt approval before verification (must fail). View and verify all linked documents, approve, then continue the existing payment/completion flow. Also test rejection/replacement, cross-user access denial, linked-file deletion denial, and file download after backend restart. Do not use real sensitive identity documents for the college demo.
