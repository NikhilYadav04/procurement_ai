# Demo recording script

**Procurix · screen recording, 4:20**

One complete workflow, from a sentence typed in chat to a payment clock the accountant can file against. Same length and shape as the first recording, rebuilt around what changed since: the clock now starts on acceptance of the goods, and the compliance work has its own page.

---

## The shape of it

**Record the product, not the deck.** Working software on screen the whole way through.

**One loop, not a tour.** Everything follows a single requirement, *250 workstation desks*, RFP-9003, from a sentence in chat to the papers an accountant files. Screens appear because the loop needs them.

**Open on the problem.** The first ten seconds are the red payment clock with ₹18.4 L already past its deadline.

**Say the cut out loud.** Real quotes take a week, so at 1:20 the recording jumps to the same RFP with three replies already in. Naming the jump reads as honest.

**The clock starts on acceptance, not the invoice.** The first recording said the opposite. This one says it correctly, on camera, at 2:50.

---

## Before recording

```bash
node scripts/seed-demo.js --reset crrajdhani@gmail.com
npx tsx scripts/verify-demo.ts crrajdhani@gmail.com      # expect 0 failed
```

- **Reseed on the day you record.** Every date is relative to the seed, so the figures spoken below are only true on that day, and the live auction closes 20 hours after seeding.
- **Reseed after every take.** Awarding and recording a delivery change the data; take two will not have three live quotes.
- **Light theme.** Check the OS theme, not just the app.
- 1920×1080, browser at 100%. Drop to **90% on the comparison screen** so all three Award buttons stay in frame.
- Bookmarks bar hidden, notifications off, single monitor.
- Gmail connected. Seeded vendor addresses end in `.example.com` and will bounce. To show a real email arriving, point Kumar at a Gmail you own in `scripts/seed-demo.js` *before* seeding.
- Record the screen first, then lay the generated voiceover over it.

---

## The script

| Time | On screen | Voiceover |
|---|---|---|
| **0:00** | Title card, 4s, then the dashboard | This is Procurix. You tell it what you need to buy, and it does the rest. It also watches a deadline most Indian firms miss. |
| **0:10** | Cursor to the payment clock | Start with why. Since 2023, paying a small registered supplier late can cost you the tax deduction on that purchase. |
| **0:20** | Open the clock, PO-9001 at the top | This one is twenty-two days past a thirty-day term. Unpaid by 31 March, ₹18,40,000 of deduction leaves this year. |
| **0:30** | Hover the interest line | And interest is already running, three times the RBI bank rate, compounded monthly. Nearly ₹22,000 so far, and nothing warned them. |
| **0:40** | Chat — type the request | Now the workflow. I need 250 workstation desks from Kumar, Rapid and Godrej. Typed the way I would say it. |
| **0:50** | Tool calls streaming | No form, no fields. The agent picks from nineteen tools on its own, checking the suppliers, then drafting and numbering the request. |
| **1:00** | RFP renders, open the PDF | Here is the RFP, a real PDF. Our company details come from the saved profile, never invented. |
| **1:10** | *Send it* → Gmail confirmation | I approve, and it leaves from my own Gmail. Suppliers just reply. No portal, no signup, no account. |
| **1:20** | Switch to RFP-9003 | Real replies take a week, so here is the same request with three answers back. A PDF, a photo of a letterhead, and a plain email. |
| **1:30** | Parsed quotes | It reads all three into price, delivery, payment terms and warranty. Anything it cannot find stays empty. It never guesses. |
| **1:40** | Comparison screen | Side by side. Kumar, ₹31,20,000. Rapid, ₹33,50,000. Godrej, ₹34,80,000. |
| **1:50** | Drag price weight up | The ranking is mine to set. Weight price, and Kumar takes it. |
| **2:00** | Drag delivery weight up | Weight delivery, and Rapid jumps to the top. Cheapest and best are not the same question. |
| **2:10** | Rapid's terms, then the score bars | But Rapid wants half up front. And this score comes from a plain function the agent calls, so the numbers cannot be hallucinated. |
| **2:20** | Award Kumar, hold on the dialog | I award Kumar. Not the agent, me. It ranks and drafts. A person commits the money. |
| **2:30** | Open PO-9003 | The purchase order carries both GST numbers, Kumar's Udyam registration, and the legal payment clause, written out. |
| **2:40** | Chat — *send the purchase order* | I ask the agent to send it. Now the terms are agreed in writing, which matters, because without that the law allows only fifteen days. |
| **2:50** | Chat — *the desks arrived today* | When the desks arrive, I just say so. The clock starts on acceptance of the goods, not when the bill turns up. |
| **3:00** | Agent's reply with the due date | Thirty days from today, tracked from here. A daily check emails me as the deadline nears, and again if it is missed. |
| **3:10** | Compliance page, the tiles | Everything lands on one page. ₹8,25,000 of deduction at risk, worked out by rules, not by the model. |
| **3:20** | Register: PO-9058, PO-9060 | Every row says why its clock started when it did. No written term, fifteen days. An objection, and the clock stopped until it was fixed. |
| **3:30** | Suppliers page | It also knows who the rule leaves out. Medium firms are not covered, and nor are traders, even tiny ones. Unknowns are flagged, never assumed. |
| **3:40** | Form MSME-1 tab | For the accountant, the government's half-yearly MSME-1 form, already sorted into its four buckets. This one is due by 31 October. |
| **3:50** | Clause 22 tab, then CSV and PDF | And the figures the tax auditor asks for under Clause 22. Download as a spreadsheet or a PDF. |
| **4:00** | Auction buyer view | One more path. Suppliers can also bid the price down live. ₹34,80,000 down to ₹30,12,000, still with no account. |
| **4:10** | End card | LangGraph over Gemini, nineteen tools, Next.js and Supabase. Procurix. Thank you. |

---

## Shot directions

What to have on screen while each clip plays. The voiceover is fixed; this is the picture that goes under it.

**Set up before you start:** dashboard open and signed in, chat empty, the payment clock banner visible in the right rail. Have the **Compliance** and **Suppliers** pages open in two more tabs.

**0:00** · Title card, 4 seconds. Then cut to the dashboard, everything at rest.

**0:10** · Move the cursor to the **Section 43B(h) payment clock** banner in the right rail. Do not click yet. It shows a red ring and PO-9001, Sharma Steel Works. **Keep clear of the small ✕ at its top right; that hides the clock.**

**0:20** · Click the banner. The panel lists every tracked payment, PO-9001 at the top with a full red ring. Hold still on it.

**0:30** · Rest the cursor on the interest line under PO-9001: *₹21,879 of interest has accrued at three times the RBI bank rate, compounded monthly.*

**0:40** · Close the panel. Click into the chat composer and **type** this, don't paste:

> Draft an RFP for 250 workstation desks for Kumar Furniture Pvt Ltd, Rapid Office Supplies and Godrej Interio. Don't send it yet.

Use the **full vendor names** and **don't send it yet**. Short names make the agent invent three new suppliers, and without the hold it drafts and sends in one go.

**0:50** · Send. Let the tool calls stream. Don't scroll, don't touch anything.

**1:00** · The RFP renders. Scroll it slowly to the buyer block, then open the PDF and scroll one page.

**1:10** · Back to chat. Type *Send it.* **Stay on the "Email sent via Gmail" confirmation until it appears**; that line is the proof.

**1:20** · Type: *read the quotes that came back on RFP-9003.* This is the jump, and the audio names it. If you sent yourself real replies (a PDF, a phone photo of a letterhead, a plain-text email), cut to the Gmail tab and show them side by side.

**1:30** · The three parsed quotes appear. Move down them: price, delivery days, payment terms, warranty.

**1:40** · Comparison screen, ranked tab, three rows full width. Let it settle so all three Award buttons are visible.

**1:50** · Drag **Price** up to about 70. Kumar takes the top. Drag slowly enough that the reorder reads on video.

**2:00** · Drag **Delivery** up. Rapid climbs to first with the *Fastest* chip. **The most convincing ten seconds in the video.** One smooth pull, no hesitation.

**2:10** · Cursor to Rapid's payment terms cell, **50% advance**. Then hover the three small criteria bars and the total score at the end of a row.

**2:20** · Click **Award** on Kumar. The browser confirmation appears. **Let it sit for two full seconds before confirming.** That dialog is the human gate.

**2:30** · Click **Open PO-9003**. Scroll the PDF: both GSTIN blocks, *Udyam UDYAM-GJ-11-0009317*, and the payment clause naming Section 15 of the MSMED Act.

**2:40** · Back to chat. Type:

> Send purchase order PO-9003 to Kumar.

Wait for the agent to confirm it was emailed with the PDF attached.

**2:50** · Type:

> The desks for PO-9003 arrived today and we accepted them.

The agent records the acceptance. It knows today's date, so you don't have to type one.

**3:00** · Hold on the agent's reply: thirty days left, the due date, and the note that the clock runs from acceptance, not the invoice.

**3:10** · Cut to the **Compliance** tab and reload it. Hold on the four tiles. **Deduction at risk** reads **₹8,25,000** in red.

**3:20** · Scroll the Register to two rows. **PO-9058**, Kumar: *15d, no written term*. **PO-9060**, Precision: *from the day the objection was removed*. Point at each as it's named.

**3:30** · Cut to the **Suppliers** tab. Sunrise Polymers (medium) and Mehta Hardware Traders (trading) show as not covered; Bharat Industrial Supply shows as unconfirmed.

**3:40** · Back to Compliance, **Form MSME-1** tab. *April to September 2026*, the four buckets, and the filing due date of 31 October.

**3:50** · **Clause 22** tab. Then click **CSV**, and **PDF**, so the downloads are seen.

**4:00** · Open the auction buyer view for AUC-9001. Bids are landing and the price is falling. If nothing moves, place one bid from the vendor tab first.

**4:10** · End card, or the repo page.

**Four places the screen can't literally show what the audio says.** None needs the audio changed:

- **1:20:** the app has no viewer for a quote's original email or attachment, hence the Gmail cut.
- **1:30:** every seeded quote is complete, so no field is actually empty. The line describes the behaviour.
- **3:00:** the alert emails go out from a daily scheduled job, so nothing arrives during the take. The line describes the behaviour.
- **4:00:** the auction runs alongside the loop rather than inside it.

---

## Two moments to protect

**2:00: the ranking reordering when the weights move.** Rehearse it so the drag is smooth and the reorder is clearly visible.

**2:50: "The clock starts on acceptance of the goods, not when the bill turns up."** This is the line a tax professional would test you on, and the product now does it right. Don't talk over it.

**If it runs long,** cut the auction at 4:00. It's a branch, not part of the loop. That lands the recording at 4:10.

---

## Voiceover, ready for text-to-speech

Written to be *spoken*. Rupee figures are spelled out, symbols and abbreviations are written the way they should be said, and contractions are expanded. Paste these straight into ElevenLabs.

**Settings:** stability around 50, similarity around 75, speed 1.0. A calm, mid-paced Indian or neutral English voice. This is a compliance product, and urgency in the voice undercuts the numbers.

**Generate segment by segment.** Each block is one 10-second slot, so you can regenerate a single line without redoing the take.

**0:00**
This is Procurix. You tell it what you need to buy, and it does the rest. It also watches a deadline most Indian firms miss.

**0:10**
Start with why. Since twenty twenty three, paying a small registered supplier late can cost you the tax deduction on that purchase.

**0:20**
This one is twenty two days past a thirty day term. Unpaid by thirty first March, eighteen lakh forty thousand rupees of deduction leaves this year.

**0:30**
And interest is already running, three times the R B I bank rate, compounded monthly. Nearly twenty two thousand rupees so far, and nothing warned them.

**0:40**
Now the workflow. I need two hundred and fifty workstation desks from Kumar, Rapid and Godrej. Typed the way I would say it.

**0:50**
No form, no fields. The agent picks from nineteen tools on its own, checking the suppliers, then drafting and numbering the request.

**1:00**
Here is the R F P, a real P D F. Our company details come from the saved profile, never invented.

**1:10**
I approve, and it leaves from my own Gmail. Suppliers just reply. No portal, no signup, no account.

**1:20**
Real replies take a week, so here is the same request with three answers back. A P D F, a photo of a letterhead, and a plain email.

**1:30**
It reads all three into price, delivery, payment terms and warranty. Anything it cannot find stays empty. It never guesses.

**1:40**
Side by side. Kumar, thirty one lakh twenty. Rapid, thirty three fifty. Godrej, thirty four eighty.

**1:50**
The ranking is mine to set. Weight price, and Kumar takes it.

**2:00**
Weight delivery, and Rapid jumps to the top. Cheapest and best are not the same question.

**2:10**
But Rapid wants half up front. And this score comes from a plain function the agent calls, so the numbers cannot be hallucinated.

**2:20**
I award Kumar. Not the agent. Me. It ranks and drafts. A person commits the money.

**2:30**
The purchase order carries both G S T numbers, Kumar's Udyam registration, and the legal payment clause, written out.

**2:40**
I ask the agent to send it. Now the terms are agreed in writing, which matters, because without that the law allows only fifteen days.

**2:50**
When the desks arrive, I just say so. The clock starts on acceptance of the goods, not when the bill turns up.

**3:00**
Thirty days from today, tracked from here. A daily check emails me as the deadline nears, and again if it is missed.

**3:10**
Everything lands on one page. Eight lakh twenty five thousand rupees of deduction at risk, worked out by rules, not by the model.

**3:20**
Every row says why its clock started when it did. No written term, fifteen days. An objection, and the clock stopped until it was fixed.

**3:30**
It also knows who the rule leaves out. Medium firms are not covered, and nor are traders, even tiny ones. Unknowns are flagged, never assumed.

**3:40**
For the accountant, the government's half yearly M S M E one form, already sorted into its four buckets. This one is due by thirty first October.

**3:50**
And the figures the tax auditor asks for under clause twenty two. Download as a spreadsheet or a P D F.

**4:00**
One more path. Suppliers can also bid the price down live. Thirty four eighty down to thirty lakh twelve, still with no account.

**4:10**
LangGraph over Gemini, nineteen tools, Next J S and Supabase. Procurix. Thank you.

---

## One-pass version

If you would rather generate the whole voiceover as a single file and cut it afterwards, paste this.

```text
This is Procurix. You tell it what you need to buy, and it does the rest. It also watches a deadline most Indian firms miss.

Start with why. Since twenty twenty three, paying a small registered supplier late can cost you the tax deduction on that purchase. This one is twenty two days past a thirty day term. Unpaid by thirty first March, eighteen lakh forty thousand rupees of deduction leaves this year. And interest is already running, three times the R B I bank rate, compounded monthly. Nearly twenty two thousand rupees so far, and nothing warned them.

Now the workflow. I need two hundred and fifty workstation desks from Kumar, Rapid and Godrej. Typed the way I would say it. No form, no fields. The agent picks from nineteen tools on its own, checking the suppliers, then drafting and numbering the request.

Here is the R F P, a real P D F. Our company details come from the saved profile, never invented. I approve, and it leaves from my own Gmail. Suppliers just reply. No portal, no signup, no account.

Real replies take a week, so here is the same request with three answers back. A P D F, a photo of a letterhead, and a plain email. It reads all three into price, delivery, payment terms and warranty. Anything it cannot find stays empty. It never guesses.

Side by side. Kumar, thirty one lakh twenty. Rapid, thirty three fifty. Godrej, thirty four eighty. The ranking is mine to set. Weight price, and Kumar takes it. Weight delivery, and Rapid jumps to the top. Cheapest and best are not the same question.

But Rapid wants half up front. And this score comes from a plain function the agent calls, so the numbers cannot be hallucinated. I award Kumar. Not the agent. Me. It ranks and drafts. A person commits the money.

The purchase order carries both G S T numbers, Kumar's Udyam registration, and the legal payment clause, written out. I ask the agent to send it. Now the terms are agreed in writing, which matters, because without that the law allows only fifteen days.

When the desks arrive, I just say so. The clock starts on acceptance of the goods, not when the bill turns up. Thirty days from today, tracked from here. A daily check emails me as the deadline nears, and again if it is missed.

Everything lands on one page. Eight lakh twenty five thousand rupees of deduction at risk, worked out by rules, not by the model. Every row says why its clock started when it did. No written term, fifteen days. An objection, and the clock stopped until it was fixed.

It also knows who the rule leaves out. Medium firms are not covered, and nor are traders, even tiny ones. Unknowns are flagged, never assumed.

For the accountant, the government's half yearly M S M E one form, already sorted into its four buckets. This one is due by thirty first October. And the figures the tax auditor asks for under clause twenty two. Download as a spreadsheet or a P D F.

One more path. Suppliers can also bid the price down live. Thirty four eighty down to thirty lakh twelve, still with no account.

LangGraph over Gemini, nineteen tools, Next J S and Supabase. Procurix. Thank you.
```

---

## Figures used, and where they come from

Every number spoken is in the seeded database and can be opened on screen. Computed by running the compliance engine on the seed's own definitions, as of the day of seeding.

| Spoken | Source |
|---|---|
| Twenty-two days past a thirty-day term, ₹18,40,000 | PO-9001, Sharma Steel Works, micro, Net 30, accepted 52 days before the seed |
| Nearly ₹22,000 of interest | PO-9001: ₹18,40,000 × ((1 + 19.5% ÷ 12)^(22 ÷ 30) − 1) = ₹21,879 |
| Kumar ₹31,20,000 · Rapid ₹33,50,000 · Godrej ₹34,80,000 | The three live quotes on RFP-9003 |
| Rapid wants half up front | Rapid's quote: *50% advance* |
| Thirty days from today | Kumar's quote is Net 30, carried onto PO-9003 |
| Fifteen days with no written term | Section 15, MSMED Act; PO-9058 shows it on the register |
| ₹8,25,000 of deduction at risk | 25% of the three breached or urgent balances: PO-9001 ₹18,40,000 + PO-9058 ₹5,00,000 + PO-9002 ₹9,60,000. Recording PO-9003 does not change it, since it starts safe. |
| Medium and traders not covered | Sunrise Polymers (medium), Mehta Hardware Traders (micro, trading) |
| MSME-1 due 31 October | April–September 2026 half-year; PO-9001 is outstanding beyond 45 days, so filing is required |
| Auction ₹34,80,000 → ₹30,12,000 | AUC-9001, six bids from four vendors |
| Nineteen tools | `agent/agent.tsx` |

Run `npx tsx scripts/verify-demo.ts crrajdhani@gmail.com` to confirm the state before recording.
