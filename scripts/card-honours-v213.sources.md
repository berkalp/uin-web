# Library honours, verified 19 October 2026

448 existing catalogue cards, 1,221 source-backed entries. No new card or personal record is created. `card-honours-v213.json` retains each catalogue/target identity and the precise source URL per entry. Generated SQL checks identity and personal-history fingerprints and rolls back on a mismatch. Re-running merges by label and source URL.

## Coverage

- **213 films:** Academy Awards Database winner records, ceremonies 1–98 (1929–2026). All available category groups were searched; 2,219 film-associated winner records were extracted. Catalogue matches require a reviewed title/alias and release-year proximity; ambiguous remakes are excluded. Displayed totals count awards won by the film and its credited contributors, not nominations. https://awardsdatabase.oscars.org/ and https://awardsdatabase.oscars.org/Help/Searching
- **101 artists:** Recording Academy artist archive career win totals. Totals cover the artist's archive; individual annual wins are not exhaustively imported. Artist-specific URLs are in the payload. Example: https://www.grammy.com/artists/bruno-mars/5082
- **37 series:** Television Academy program pages, all winner-badged entries on each matched program page. Totals and annual counts distinguish wins from nominations and include the credited team. Example: https://www.televisionacademy.com/shows/game-thrones
- **15 additional books:** Nobel Literature laureate archive, complete available years, exact author identity with reviewed transliterations. These are explicitly **author** honours, never presented as awards for the book itself. Previously curated book/series/game awards remain visible through the shared adapter. https://api.nobelprize.org/v1/prize.json?category=literature
- **82 club branch cards:** UEFA historical winner tables, TFF champions/cup tables, NBA franchise champions archive, and individual official EuroLeague/FIBA records. Branch and gender are required. Previous franchise names are included only where the official NBA history treats them as the same franchise. Root club cards never inherit a particular branch's trophies.

## Sports sources

- https://www.uefa.com/uefachampionsleague/history/winners/
- https://www.uefa.com/uefaeuropaleague/history/winners/
- https://www.uefa.com/uefaconferenceleague/history/winners/
- https://www.uefa.com/uefasupercup/history/2000/
- https://www.tff.org/default.aspx?pageID=545
- https://www.tff.org/default.aspx?pageID=411
- https://www.nba.com/news/history-nba-champions
- https://mediacentre.euroleague.net/mediacentre/en/press_releases/5
- https://mediacentre.euroleague.net/en/app/2/communication/communication/preview/23235
- https://mediacentre.euroleague.net/en/app/2/communication/communication/preview/24294
- https://mediacentre.euroleague.net/en/app/2/communication/communication/preview/24306
- https://about.fiba.basketball/en/regions/europe/news/mersin-to-host-supercup-women-2026
- https://www.galatasaray.org/s/2014-fiba-euroleague-women/53

This is verified coverage, not a claim that every award organization or every catalogue entry is exhaustive. The common card component has no category or ten-year limit. Entries without verified honours have no invented badge. Existing dated popularity/ranking data remains a historical snapshot, not a live ranking.
