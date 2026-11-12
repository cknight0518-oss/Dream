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

1. **Landing page**: a turning 3D house, plus "Start designing" or "See an example" (a filled-in sample home).
2. **Interview** (`js/questions.js`): 11 topics: location & budget, size, exterior, outdoor, interior style, living areas, kitchen, bedrooms, bathrooms, bonus rooms, deal-breakers.
   - Exterior style, color scheme, interior style, room styles and cabinet colors are picked from photo cards (`assets/cards/`, listed in `js/photos.js`). Photos are from Wikimedia Commons and Openverse (mostly Flickr) under free licenses (CC0, public domain, CC BY, CC BY-SA), and each page shows the credits those licenses require. A card without a photo falls back to a drawing (`js/illustrations.js`).
   - A **live 3D preview** sits beside the questions and rebuilds on every answer. It shows the outside for exterior topics and steps inside to the relevant floor for interior topics.
   - Picking an exterior style sets the siding, roof and porch to match, unless you've already chosen them.
   - Budget and size use two-handle sliders. Enter moves to the next step, and the browser back button works.
   - Answers are saved to `localStorage` as you go.
3. **3D model** (`js/house3d.js`, `js/furniture.js`, `js/materials.js`): a procedural three.js model built from the answers.
   - Rendering: PBR textures, image-based lighting from a sky HDRI, soft shadows and screen-space ambient occlusion (GTAO). Textures and the HDRI are CC0 from Poly Haven (`assets/textures/`).
   - Lighting presets: day, golden hour and dusk. At dusk the windows glow and the porch, path and street lights turn on.
   - **Exterior:** footprint from square footage and stories, a roof shape that matches the style, windows, porch, garage, chimney, turret/dormers/half-timbering, pool, deck, fence and garden, set on a street with a sidewalk and neighboring houses.
   - **Interior:** a cutaway "dollhouse" for each floor. Rooms come from a squarified treemap, with walls, doorways, windows, a front door, stairs and furniture for each room type. It's a sketch, not an architectural plan.
   - Camera presets: corner, street, aerial and backyard outside; dollhouse and top-down plan inside.
4. **Results page**: a large 3D viewer with floor, camera and lighting controls, turntable, full screen and image export. It also has:
   - A plain-English description of the home and a moodboard of the chosen styles.
   - Every answer, each with an Edit link.
   - The Zillow search.
   - A monthly payment estimate.
   - A share link that encodes the answers in the URL, and print/PDF.
5. **Zillow search** (`js/zillow.js`): turns the profile into search criteria. Only the items you mark as deal-breakers become hard filters. The "how strict" answer loosens size, bedroom and bathroom minimums so near-matches still show up.
6. **Payment estimate**: standard amortized payment, plus property tax, insurance, HOA and a rough PMI estimate under 20% down. It also shows the income that keeps housing at 28% of gross pay. The default rate (6.5%) is a placeholder, so enter a current quote.

## Zillow alerts: what the app can and can't do

Zillow has no public API for creating saved searches or alerts. Its old public API was shut down in 2021, and its current data platform (Bridge Interactive) is mostly limited to MLSs, brokers and approved partners. So the app does two things instead:

- **A zillow.com search link.** The user opens it, clicks **Save search**, and sets alerts to **Instant**. Zillow then emails them when a matching home is listed. The link uses the `searchQueryState` URL parameter that zillow.com writes itself. **This format is undocumented and hasn't been tested against the live site from here.** Price, beds, baths, sqft, home type and keywords are the most likely to apply. `pool`, `parkingSpots`, `lot` and `built` are less certain. The UI tells the user to check the filters before saving.
- **A request body for the Zillow connector's `zillow_property_search` tool**, which follows that tool's published schema, so an assistant with the connector can run the same search.

To send notifications from the app itself, you'd need a backend with licensed listing data (Bridge or a direct MLS/IDX feed), a scheduled job that runs each saved profile's criteria, and email or push delivery.

## Files

```
index.html          page shell + import map
css/styles.css      styles (light/dark, mobile)
js/app.js           landing page, interview, live preview, results, persistence
js/questions.js     interview script
js/styles-data.js   style/color definitions shared by cards and 3D
js/illustrations.js SVG card art
js/house3d.js       3D model, lighting, street scene, interior views
js/furniture.js     furniture pieces for the interior views
js/zillow.js        profile → Zillow URL / connector request
js/materials.js     textured materials + world-scale UV projection
js/photos.js        card photo list with attribution (generated)
assets/cards/       card photos (Wikimedia Commons, Openverse)
assets/textures/    PBR textures + sky HDRI (Poly Haven, CC0); the HDRI is base64 in sky.hdr.json so any static host serves it
assets/CREDITS.md   full attribution for every photo and texture
vendor/             three.js 0.160.0 + OrbitControls, RGBELoader, post-processing (MIT)
```
