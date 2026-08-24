# 🏊 🚴 🏃 Triathlon Time Predictor

A small web app that predicts your triathlon finish time for any distance,
based on your past race performances.

## Try it

Open `index.html` in any browser — it's a fully self-contained static site
(no build step, no server, no dependencies). To host it, push it to
**GitHub Pages** and it just works.

## How to use

1. **Log your past races** — for each race enter the distance (Sprint,
   Olympic, 70.3, Ironman, or custom) and your swim / bike / run split times
   (transitions optional).
2. **Pick a target distance** you want to predict.
3. **Get your predicted finish time** — with a per-discipline breakdown,
   pace for each leg, and a confidence range.

Your data is stored only in your browser (`localStorage`); nothing is sent
anywhere. Click **Load sample data** to see it in action instantly.

## How the prediction works

Each discipline is projected independently using **Riegel's endurance
formula**:

```
T₂ = T₁ × (D₂ / D₁) ^ k
```

where `k` is a fatigue exponent slightly above 1 (swim 1.02, bike 1.04,
run 1.06) that captures the natural slow-down as distance increases.

Every past race is projected to the target distance, and the projections are
combined with **recency weighting** (a 12-month half-life, so recent races
count more). Transitions are averaged from your history, and the confidence
band narrows as you log more races.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure & UI |
| `styles.css` | Styling |
| `app.js` | Prediction engine, storage, rendering |

Estimates are for guidance only — train smart and race safe. 🏁
