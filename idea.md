##Formula 1 Predictor 
We want to create a Formula 1 fantasy/predictor web-app. Every person will log in using their mobile number, wherein for every Formula One event they will give their predictions, and we will maintain a score for each user.

1. Login for each person - maintain profile {based on favourite team, driver}

2. formula1 calendar - pull all the f1 events from formula 1 website (https://www.formula1.com/en/racing/2026)

3. UI - inspired by formula 1 website (https://www.formula1.com/)

4. also show formula1 telemetry and data - stats of driver performances - that would nudge the users in their prediction

5. Prediction based on event - pull from f1 calendar - if {qualifying, race} -> take p1, p2, p3 predictions, if {sprint quali, sprint race} -> take 
only p1 prediction - keep those predictions locked until the event completes
reveal everyone's prediction and score post that event happens

6. Prediction can be given only before the event starts

7. For each correct prediction, the user will be awarded 1 point. 

8. Maintain scoring of each user for a single season (for example, 2026 season)


Screens 

Screen #1 - Login (User X logins using their mobile number)

Screen #2 -  Profile (ask questions about favourite team and driver in Formula 1 - both current and past)

Screen #3 - Dashboard 
    Tab #1 - Current Season Statistics and Data (Driver Standings, Team Standings, Number of Wins, Number of Podiums etc - https://www.formula1.com/en/results/2026/races)

    Tab #2 - Scoring and Standings of every user for current season
    Show all scores here

    Tab #3 - Give your prediction - Choose from current drivers 
    for example, for race give p1, p2, p3 (eg, p1 = Charles Leclerc, p2 = George Russell, p3 = Oscar Piastri)
    Lock these predictions, reveal individual scores here

