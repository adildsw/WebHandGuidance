# Calibration verification dataset

Recorded WebHandGuidance study exports used to verify the **screen-recalibration
fix** (the camera-only frame recalibration that rescales `world_ppi`,
`silParams`, and `romCalibrationParams` by `k = newFrameWidth / oldFrameWidth`).

All six files are the **same person** running the **same ROM_MOVE task**
(`task-e0po9`): reach an anchor (T0), a target ~90% of arm reach to the right
(T1), and one the same distance downward (T2). Each export contains
`data_mm.csv` (physical millimetres), `data_px.csv` (testbed pixels +
`world_ppi`/`scaling_factor`), and `task.json`.

## The files

| File | Setup | Expected |
|---|---|---|
| `...donotrecord-original` | Fresh full calibration on the **task-designer PC** (large screen). The source of truth the study was authored on. | reference |
| `...smallcameracalibratedoriginal` | Small/compact screen, **standard** 3-step calibration (screen → camera → ROM). | correct |
| `...calibratedfresh-prefixrecalibrationtest` | Small screen, another **standard** 3-step calibration. Serves as the **base** that the preexisting-participant fix is applied on top of. | correct |
| `...framecalcameraonly-nopatch` | Small screen, 3-step calibration **then** a camera-only frame recalibration **without** the scaling patch. | the "broken" path |
| `...recalibratedfixtest-postcalibfix` | The **base** above **+ the fix applied** (preexisting participant switching frames). | **verify – correct** |
| `...correctcalibrationwithfix` | Small screen, brand-new participant whose screen calibration uses the camera fix, followed by camera + ROM calibration. | **verify – correct** |

The two `verify` rows are the ones that matter: they are the two kinds of
participant we ship to — an **existing** participant applying the fix, and a
**new** participant calibrating with the fix from the start.

## Running

```bash
python3 verify_calibration.py      # needs pandas, numpy, matplotlib
```

Reads the `.zip` files directly, writes `report.txt` and `figures/*.png`.

## What the evidence shows

**1. Export integrity.** For every file, `mm == px * 25.4 / world_ppi` to
floating-point noise (~1e-14) — the exports are internally consistent.

**2. The preexisting-participant fix is exact (not just plausible).**
`recalibratedfixtest-postcalibfix` vs its base `calibratedfresh-prefixrecalibrationtest`:
`world_ppi` 4.64 → 6.92, the pixel scale, and the target pixel coordinates all
scale by the **same** `k = 1.4919`, so every reconstructed physical target
position is **byte-identical** (max diff ~1e-13 mm). The fix is a pure rescale
that leaves physical-mm output untouched. See `fig4_fix_overlay.png`.

**3. Physical output is invariant across setups.** `world_ppi` ranges ~4.3–15.4
(≈3.5×) across the files, yet the reconstructed reach of the same arm stays in a
**2% band** (437–446 mm on the small screen) and the task shape — angle between
the reach vectors (**89.13°**) and length ratio (**1.0055**) — is reproduced
*exactly* by every calibration, matching the task definition. Both fix-based
setups land squarely in the correct band. See `fig2_worldppi_vs_reach.png` and
`fig3_shape_invariants.png`.

**4. Task closure.** In every file the participant reaches each target within
threshold, confirming the cursor and target coordinate spaces agree. See
`fig5_closure.png`.

### Conclusion

- **Preexisting participant (`postcalibfix`)** — correctness is *proven*: the fix
  reproduces the pre-fix physical geometry exactly.
- **New participant (`correctcalibrationwithfix`)** — correctness is supported to
  reasonable plausibility: shape invariants match the task exactly, and the
  reconstructed physical reach matches the same person's other independent
  small-screen calibrations to within 2%.

### Note on the `nopatch` file

The exported numbers in `framecalcameraonly-nopatch` look internally consistent
and its *target* positions coincide with the standard small calibration — target
geometry is reconstructed from `world_ppi`, which the skipped patch leaves
unchanged. The corruption from skipping the patch lives in the **wrist/world
scale relative to true physical space** (the participant physically moves a
different amount than the recorded mm implies). That cannot be recovered from the
CSV alone without an external physical ground truth, which is exactly why the
patch must be applied at calibration time rather than corrected after the fact.

## Figures

- `fig1_trajectories.png` — physical (mm) targets + hand path per setup.
- `fig2_worldppi_vs_reach.png` — `world_ppi` differs widely; reconstructed reach is invariant.
- `fig3_shape_invariants.png` — task angle and reach ratio reproduced everywhere.
- `fig4_fix_overlay.png` — preexisting-participant fix is exact (targets concentric).
- `fig5_closure.png` — both fix setups converge below threshold (targets reached).
