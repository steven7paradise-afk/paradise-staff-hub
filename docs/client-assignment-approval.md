# Clienti arrivate — approvazione reception

Implementation prepared locally; publish server routes and update both native apps together.

- Personal authenticated mobile accounts, not shared salon sessions, can see waiting clients only in their currently clocked-in assigned salon. Unknown booking locations fail closed. No private control-form answers or contact details are returned.
- Mobile has separate “Le mie clienti” (existing assignment authorization) and “Clienti arrivate” (today's waiting clients). Entry/return required to request; pause and an existing in-progress client disable requests.
- A request is not an assignment. It creates an open `salon_live` item of kind `assignment`, with retry ID and duplicate suppression. It triggers the existing revision stream and Mac pop-up queue.
- Reception uses the authorized salon PC and an identified operator. Approval explicitly replaces the previous team with the requesting worker and starts the service timer. A confirmation explains this. Rejection does not change appointment data.
- Approval rechecks day, salon, worker eligibility, attendance, availability, waiting status and assignment/status revisions. Assignment, timer, decision, audit and revision event commit in one serializable transaction. Concurrent modifications fail rather than silently overwrite.
- Existing generic desk actions must reject kind `assignment`. Older Mac builds cannot approve it; use the updated native app.
- Current implementation updates the local appointment overrides used by Mac/web/mobile, not external Cowlendar or Shopify staff notes.
- No real requests or assignments were submitted during verification. Policy tests and native builds are not an end-to-end production approval test.

Release QA: on a test appointment, request as a clocked-in free worker; verify pending state, Mac popup, reject, retry and approve; verify the new owner and timer on all clients. Race two reception approvals; repeat the same request/decision; test pause/exit, changed assignment, wrong salon and expired date. Do not use a real customer's assignment as a test.
