# Kitty — Future Plan

This document collects the product ideas discussed for future Kitty iterations.

## Already implemented from the ideas list

- Live activity announcements for joins, departures, item changes, restriction changes, and finalization.
- Browser voice announcements for activity updates, with the current participant's own join/leave events kept silent.
- Immediate server-side participant registration when a name is chosen.
- Guest **Leave Kitty** action that removes the participant, items, and restrictions; hidden from the host.
- Safe invite-link copying that removes the private `host` parameter.
- Dietary conflict indicators and friendly restriction explanations in the order UI.

## Product enhancements

- **Live activity feed:** A visible timeline such as “Alex added Taco Plate” or “Priya flagged vegan.”
- **Presence indicators:** Show who has joined and who is currently viewing the order.
- **Split modes:** Let the group switch between itemized payment and equal sharing.
- **Smart conflict explanations:** Explain exactly why an item conflicts with a restriction.
- **Shareable receipt:** Generate a clean summary of participants, items, restrictions, totals, and amounts owed.
- **Undo action:** Allow a participant to undo a recent add, remove, or restriction change.
- **Order status:** Let the host mark the order as submitted, accepted, paid, or delivered.
- **Join confirmation:** Show a friendly confirmation and participant count immediately after joining.

## Gemini-powered intelligence

Gemini could provide a server-side smart menu assistant while the fixed menu allow-list and WebMCP tools remain responsible for actual changes.

- Parse requests such as “I’m vegan, gluten-free, and want something under $10.”
- Recommend only compatible menu items.
- Explain dietary conflicts in natural language.
- Summarize the complete group order and split.
- Detect duplicate or unusually large orders.
- Generate friendly activity summaries.

API credentials must remain server-side in managed secrets or `.env`; never expose them in browser code or chat.

## Audio-only group call

For a future “Join group call” feature, use Twilio Voice SDK rather than video:

- Shared audio conference per Kitty session.
- Microphone permission only; no camera access or video tracks.
- Mute/unmute, participant names, speaking status, and leave-call controls.
- Optional AI-generated order summary after the call.

Twilio Voice is usage-billed. A Twilio Video Group Room could also be audio-only, but participant-minute charges still apply. A free browser WebRTC audio room is possible with custom signaling, but is more complex to operate reliably.

## Demo and polish ideas

- Narrated activity timeline showing multiple agents working on one order.
- A visible “friend joined” moment during the demo.
- A final receipt view showing both itemized totals and equal-share suggestions.
- Clear host-only controls and guest-safe invite links.
