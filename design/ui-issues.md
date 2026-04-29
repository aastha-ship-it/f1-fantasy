## Issues with Implementation 

design screenshots - /Users/aasthakataria/Documents/f1 fantasy/design/design-screenshots

NOTE : for reference, I have added screenshots to /Users/aasthakataria/Documents/f1 fantasy/design/implementation-screenshots and highlighted the issues

1. /join screen - screenshot (/join)
    Left panel - text is overlapping over each other which is creating a bad UX. Add a bit of spacing and compare it to actual design.

2. /dashboard/predict - screenshot (/dashboard/predict)
    When the user clicks on 'CONTINUE PICKS' - we must show them all the events of that particular Grand Prix (for instance, Miami Grand Prix has 4 events - Sprint Qualifying, Sprint, Qualifying, Race) - the user can select any one of them and lock-in their picks. This is the idea.

    While in the 'UPCOMING' section - we only show upcoming F1 Grand Prix Weekends (Canada, Monaco, Barcelona etc) - NOTE : This one is implemented correctly. 

3. /dashboard/predict/[eventId] - screenshot (/dashboard/predict/[eventId])
    a. for some drivers, like Max Verstappen - blue colored 'Red Bull Racing' is not visible - ensure UI is accessible
    b. 'TELEMETRY' is not coming up for any driver. 
    c. Refer screenshot - (/dashboard/predict/[eventId] - 2) - Specifically for 'Sergio Perez' and 'Valtteri Bottas' - when we select them, their image is not coming up - their implementation is not complete - while for other drivers it is complete
    d. Refer screenshot - (/dashboard/predict/[eventId] - 3) - when the predictions are locked in by clicking 'LOCK IN PICKS' - currently a basic notification in green color comes up 'Picks saved'. Instead what we should implement - 
        1. A notification banner in F1 style saying - "Picks saved'
        2. The button 'LOCK IN PICKS' should change to 'LOCK IN FOR OTHER EVENTS' - basically if the user has locked in prediction for Sprint Qualifying, now we can give them option to lock the picks for other events (Sprint, Qualifying, Race) by taking them back to previous screen.

4. /dashboard/league - screenshot (/dashboard/league)
    a. Again the blue color of 'Team Red Bull Racing' is not visible. Ensure that this blue color issue is resolved and ensure accessibility across all screens.

5. /admin/results/<eventId> - screenshot (/admin/results/<eventId>)
    a. When they ask me to fill results - it only asked me to fill the results for one event - while all three events (Australia, China, Japan) - had more than 1 events (Sprint Qualifying, Sprint, Qualifying, Race) - for each event it should ask the admin to classify results
    b. Right: SCORE PREVIEW section not visible

6. /admin - screenshot (/admin)
    a. In the PICKS section - why is it saying '0 picks 1/2 results' - because it didn't give me the option to fill results for all the events

7. /reveal/[eventId] - screenshot (/reveal/[eventId])
    a. text is overlapping over each other which is creating a bad UX. Add a bit of spacing and compare it to actual design.
    b. screenshot (/reveal/[eventId] - 2) - in the actual design full portraits of every driver on the podium is visible (Piastri, Leclerc, Norris) - but in our implementation, only small circle with driver photo is visible - make it consistent with the design
