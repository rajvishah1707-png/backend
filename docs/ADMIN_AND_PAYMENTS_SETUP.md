# Admin management and Razorpay test payment setup

Deploy the backend and frontend PRs together. Existing admin screens now require an admin JWT. Log out and log in again if a previously saved session lacks `adminToken`.

## Render environment

Keep existing MongoDB, JWT, Brevo and Cloudinary values. Add:

```
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_chosen_webhook_secret
```

Do not put secrets in React, GitHub or chat. The implementation deliberately accepts **test keys only**, and all receipts are labelled as test receipts. No Razorpay npm dependency is needed; backend Node 18+ uses the signed server API.

In Razorpay Test Mode, enable automatic capture and configure this webhook URL:

```
https://backend-1df5.onrender.com/api/payments/webhook
```

Use the same webhook secret configured in Render. Subscribe to `payment.captured`, `payment.failed`, `order.paid` and `refund.processed`. Refresh Payment also reconciles with the provider if checkout was closed or callback delivery was interrupted. The raw-body webhook route is registered before JSON middleware.

## Service fees and existing applications

- In Admin Services enter `Free`, `0`, or an exact INR amount such as `250.00` or `₹250`. New citizen applications snapshot the server's service ID and fee, so later service edits do not change their payable amount.
- Descriptive fees such as “As applicable” remain unassessed. They are never guessed or treated as free.
- For legacy applications and descriptive fees, open Admin Payments → Assess Fee. Enter the final fee once (0 for free). This assessment is immutable after saving. An erroneous amount requires administrative resolution, not silently editing an existing order.
- Admin approves the application. Citizen opens Payments and uses Pay. Pending, rejected, free and unassessed applications do not have checkout.
- Payment is marked Paid only after server verification of order, amount, currency and captured status. Completion of a paid service requires verified, unrefunded payment. Application status and payment status are separate.
- Applications and citizens with payment records cannot be deleted; retain the record or deactivate the citizen.
- Refund initiation is not part of this module. Provider-recorded refunds are reconciled and subtracted from collection totals. A refunded order cannot be paid again automatically.

## Interrupted order creation

Each application has one payment record and reuses the same Razorpay order. Database claims prevent repeated clicks from creating extra orders. A request whose outcome is uncertain is retained as Creating/Needs Review; do not reset it or create another order blindly.

Find the stored receipt in Razorpay Test Mode, then use Admin Payments → Recover Provider Order. The backend checks the receipt, amount, currency and payment record ID in provider order notes before attaching it. If no provider order exists, investigate with provider logs before any manual database repair. Automatic reset of ambiguous records is intentionally unavailable.

## Management sections

- Categories include categories already present on services plus newly added names. Categories in use must be reassigned before rename/delete. Admin Services suggests saved names; citizen filters use actual active service categories.
- Notifications: choose one citizen and create a persisted in-app notification. No email or broadcast is sent by this feature.
- Feedback: citizens submit ratings/messages; admins view and reply. Citizens can read their own replies.
- Statistics: application counts and test payment totals. “Citizens Who Have Logged In” is a historical count, not currently online users.
- Payment list is paginated at 25 applications; search filters the displayed page. Dashboard financial totals cover all records. Notifications and feedback show the latest 100 records.
- Report Issue now persists complaints instead of displaying a local success message.

## Verification before use

1. Register/login a citizen; apply to a numeric-fee service.
2. Verify Pay is absent before approval. Approve from admin Applications.
3. In citizen Payments complete a test payment; verify receipt, logout/login persistence and admin totals.
4. Test failed/cancelled checkout, refresh recovery, duplicate clicks and a free service.
5. Ensure anonymous and citizen requests cannot access admin APIs or mutate services.
6. Verify category CRUD, a targeted notification, a citizen feedback submission and an admin reply.

Automated checks use mocked models/provider responses. They do not prove live MongoDB writes, provider credentials or webhook delivery. Run the steps above on deployment using test keys before considering any live payment integration.
