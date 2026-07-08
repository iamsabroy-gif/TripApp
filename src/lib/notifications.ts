// Notification hook stub (FSD §8.3): no email/SMS/WhatsApp integration at
// launch. On every new enquiry we POST to an optional webhook URL so an
// email/SMS provider can be wired in later with zero schema/API rework.

export interface EnquiryNotification {
  enquiryId: string;
  tripId: string;
  tripName: string;
  name: string;
  phone: string;
  email: string;
  submittedAt: string;
}

export async function notifyEnquiryCreated(payload: EnquiryNotification): Promise<void> {
  const url = process.env.ENQUIRY_WEBHOOK_URL;
  if (!url) return; // notifications disabled — admin checks the dashboard

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "enquiry.created", data: payload }),
    });
  } catch (err) {
    // Never fail the enquiry submission because of a notification error.
    console.error("Enquiry webhook notification failed:", err);
  }
}
