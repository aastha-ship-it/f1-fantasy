Changes in our F1 Fantasy App

1. Let's create one more tab 'Predictions' tab. Here, for one particular session (let's say Qualifying of Canada GP), we will show the following : 
- For every user, if they have 'Locked' the prediction or not 
- Now, after sometime (one-third of the total duration of a session) - we will reveal everyone's P3 prediction. For instance, a race is typically 1.5 hours long, so after half an hour we will reveal everyone's P3 prediction - This will improve engagement
- Now, after another one-third of the total duration of a session - we will reveal everyone's P2 prediction. For instance, a race is typically 1.5 hours long, so after an hour we will reveal everyone's P2 prediction
- After the session is over, now we will reveal everyone's P1 on the Predictions Tab. As well as, final results on the Reveal Tab.


2. when we are showing telemetry, last 5 results of any particular driver. We are currently showing it from 'right -> left' (latest result is the leftmost). Let's convert it to 'left -> right' (latest result is the rightmost). This is a sports convention.


3. Let's add Google Calendar based reminders. Let's give an option to sync your google calendar with F1 calendar since users are already signing up through their google emails. When they sync the calendars, they will automatically receive a reminder notification to lock their predictions 30 minutes before start of any session. 
Currently, F1 also gives an option to 'Add F1 calendar' on their website - https://www.formula1.com/en/racing/2026
I have used this feature, and I get a reminder notification before any F1 session.


4. Let's also change the point system. 
Current Point system : 
    - Exact slot (prediction matching the exact slot) -> 5 points 
    - On podium, wrong slot -> 2 points 
    - Miss (prediction is not on podium) -> 0 points
    - Perfect Podium -> +3 points 

New Point system :  
    - Exact slot (prediction matching the exact slot) -> 5 points 
    - Perfect Podium -> +3 points
    - Out of the full podium prediction, only one driver is on the podium, but on wrong slot -> 1 point
    - Out of the full podium prediction, only two drivers are on the podium, but both are on the wrong slot -> 2 points
    - Out of the full podium prediction, all three drivers are on the podium, and all three are on the wrong slot -> 4 points 
    - Out of the full podium prediction, one driver is having exact slot, and one driver is on the podium but on wrong slot -> 5+1 = 6 points
    - Out of the full podium prediction, one driver is having exact slot, and two drivers are on the podium but both are on the wrong slot -> 5+2 = 7 points
    - Miss (prediction is not on podium) -> 0 points

5. Let's also show point system in a very systematic way on the UI for the user. This will help them in better understanding.

6. Show Free Practice podium results (FP1/FP2/FP3) as a banner on the predict round page (/dashboard/predict/round/[id]) to help participants while locking their predictions.
   - Standard weekends have FP1, FP2, FP3; Sprint weekends have only FP1.
   - Sourced on-demand from OpenF1 (cached ~15 min, no cron) — appears automatically within ~15 min of each FP session ending.
   - Admin can override an FP slot's top-3 (wins over the live OpenF1 fetch) for when OpenF1 is late/wrong/cancelled.
   - Display: position + driver code + fastest-lap time (lap time shown only when sourced from OpenF1; "—" on an admin override).

7. Fetch OpenF1 results for every scoring session (Sprint Qualifying, Sprint, Qualifying, Race) after it ends, with admin override.
   - Trigger: an admin "Fetch from OpenF1" button on /admin/results/[eventId] (one click → fetch + score). The nightly fetch-results cron stays as a backstop.
   - Override/freeze: once results are admin-entered OR the event is revealed, the automatic/OpenF1 path never changes them. Before reveal an OpenF1 row may still be refreshed (provisional → official).
   - Reveal stays admin-triggered; the predictions reveal fallback is lengthened 10 min → 1 hour so a prompt fetch can't auto-spoil the cinematic.

8. Move the scoring explainer into a "How Scoring Works" modal.
   - Remove the inline scoring legend from the Lobby tab and the Predict detail screen.
   - Replace the shared TopBar "The Group · {season}" label with a "How Scoring Works" trigger (drops the season indicator there).
   - Clicking it opens a modal showing the point system. The trigger is global (every authenticated screen) and visible on mobile too.