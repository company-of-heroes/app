# @company-of-heroes/smurf-worker

## 0.1.3

- improvement; far fewer API requests: live lobbies and the OBS overlay follow realtime instead of polling, comments and likes no longer reload while a match waits for its result, the app checks for updates every hour (installing only outside a match), and the website and smurf worker can reach PocketBase without passing the api-gateway

## 0.1.2

- fix; smurf detection finds the family-sharing lender while a match is running and flags accounts that play without owning CoH

## 0.1.1

- fix; detect family-share smurfs via Steam only without cohstats
