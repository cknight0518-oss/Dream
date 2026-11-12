# Dream Home Builder

A web app that interviews you about your dream home, builds a 3D model of it, and turns your answers into a Zillow search you can save for new-listing alerts.

## Running it

It's a static site with no build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

ES modules don't load from a `file://` URL, so opening `index.html` directly won't work. three.js 0.160.0 is in `vendor/`, so the app works offline.

## How it works

1. **Interview** (`js/questions.js`): 11 topics: location & budget, size, exterior, outdoor, interior style, living areas, kitchen, bedrooms, bathrooms, bonus rooms, deal-breakers. Exterior style, color scheme, interior style, room styles and cabinet colors are picked from photo cards (`assets/cards/`, listed in `js/photos.js`). Photos are from Wikimedia Commons under free licenses, and each page shows the credits those licenses require. If a card has no photo, it falls back to a drawn illustration (`js/illustrations.js`). Kitchen, bedrooms, bathrooms and bonus rooms can each have their own style or use the overall interior style. Answers are saved to `localStorage` as you go.
2. **3D model** (`js/house3d.js`, `js/materials.js`): a procedural three.js model built from the answers. It uses real PBR textures (siding, brick, stone, stucco, shingles, metal, clay tile, slate, concrete, pavers, wood, grass) and image-based lighting from a sky HDRI, with ACES tone mapping and soft shadows. Textures and the HDRI are CC0 from Poly Haven (`assets/textures/`). What it includes:
   - **Exterior:** footprint from square footage and story count, a roof shape that matches the style (gable, hip, flat, shed), windows, porch, garage with one door per car, chimney if there's a fireplace, turret/dormers/half-timbering for Victorian/Cape Cod/Tudor, and pool, deck, fence and garden in the yard.
   - **Floor plans:** one per floor (plus a finished basement). Rooms are laid out with a squarified treemap, so the plan is a rough sketch, not an architectural layout. Room colors come from each room's chosen interior style.
3. **Zillow search** (`js/zillow.js`): turns the profile into search criteria. Only the items you mark as deal-breakers become hard filters. The "how strict" answer loosens size, bedroom and bathroom minimums so near-matches still show up.

## Zillow alerts: what the app can and can't do

Zillow has no public API for creating saved searches or alerts. Its old public API was shut down in 2021, and its current data platform (Bridge Interactive) is mostly limited to MLSs, brokers and approved partners. So the app does two things instead:

- **A zillow.com search link.** The user opens it, clicks **Save search**, and sets alerts to **Instant**. Zillow then emails them when a matching home is listed. The link uses the `searchQueryState` URL parameter that zillow.com writes itself. **This format is undocumented and hasn't been tested against the live site from here.** Price, beds, baths, sqft, home type and keywords are the most likely to apply. `pool`, `parkingSpots`, `lot` and `built` are less certain. The UI tells the user to check the filters before saving.
- **A request body for the Zillow connector's `zillow_property_search` tool**, which follows that tool's published schema, so an assistant with the connector can run the same search.

To send notifications from the app itself, you'd need a backend with licensed listing data (Bridge or a direct MLS/IDX feed), a scheduled job that runs each saved profile's criteria, and email or push delivery.

## Files

```
index.html          page shell + import map
css/styles.css      styles (light/dark, mobile)
js/app.js           interview flow, results page, persistence
js/questions.js     interview script
js/styles-data.js   style/color definitions shared by cards and 3D
js/illustrations.js SVG card art
js/house3d.js       3D model + floor plans
js/zillow.js        profile → Zillow URL / connector request
js/materials.js     textured materials + world-scale UV projection
js/photos.js        card photo list with attribution (generated)
assets/cards/       card photos (Wikimedia Commons)
assets/textures/    PBR textures + sky HDRI (Poly Haven, CC0)
assets/CREDITS.md   full attribution for every photo and texture
vendor/             three.js 0.160.0 + OrbitControls + RGBELoader (MIT)
```
