---
name: submission-review
description: Review an Open-H-Hospital dataset submission for format compliance, required metadata, Cartesian end-effector kinematics, and hours accounting. Use when asked to review, validate, or grade a contributed dataset.
---

# Submission Review

Review a contributed dataset against Open-H-Hospital v2 requirements. Submissions are LeRobot format v3.0 datasets (the guide pins the `lerobot[dataset]==0.6.0` package; any lerobot >= 0.4.0 can read format v3.0, and the package version and the dataset format version are separate versioning schemes). Contributions are measured in hours of synchronized data against the per-setting minimums in the RFP; trajectory counts are supplementary context only.

## Procedure

### 1. Run the validator

```bash
python scripts/validation/validate_formatting.py <dataset_path> --verbose
```

Capture the full report. Every ERROR must be resolved before acceptance; WARNINGs become fix items in the review.

### 2. Verify the LeRobot v3.0 layout and the dataset README

Expected layout:

- `meta/info.json` with `"codebase_version": "v3.0"`
- `meta/stats.json`
- `meta/tasks.parquet`
- `meta/episodes/chunk-*/file-*.parquet`
- `data/chunk-*/file-*.parquet` (each parquet aggregates MULTIPLE episodes)
- `videos/<camera_key>/chunk-*/file-*.mp4`

If you see `meta/episodes.jsonl`, `meta/episodes_stats.jsonl`, `meta/tasks.jsonl`, or `data/chunk-*/episode_*.parquet`, the dataset is still v2.1: the contributor must convert with the official script (module `lerobot.scripts.convert_dataset_v21_to_v30` in lerobot 0.6.0; for local-only datasets add `--root <dataset_dir> --push-to-hub false`, where `--root` is the dataset directory itself).

Confirm `meta/README.md` exists and is a completed copy of `templates/dataset_template.md`: no unfilled `[...]` placeholders, and the synchronization section documents the method and sample rates.

### 3. Check required metadata

Every submission must state, in `meta/README.md` and the dataset metadata:

- Task group (robotic surgery, robotic ultrasound, or other healthcare robotics) and the demonstrated tasks or skills.
- Robotic platform(s).
- Collection setting (clinical, in-vivo, ex-vivo, phantom / table-top, or simulation).
- Modalities present, with synchronization method and sample rates.
- Licence (OpenMDW-1.1) and de-identification status (HIPAA Safe Harbor or equivalent, GDPR for European contributors, including scrubbing imaging and video metadata on export).
- Where a robot is involved: calibration data and robot CAD / kinematic-tree descriptions (USD, URDF, DH parameters, or equivalent). Hand-eye calibration is not required.
- Camera intrinsics (encouraged for calibrated optical cameras): a `meta/calibration/camera_intrinsics.json` file keyed by camera feature name. Note its absence as a fix item, not a hard blocker.
- Encouraged (note their absence, do not fail on it): time-aligned narration or sub-task descriptions, correlated anonymized patient information, demonstration-quality labels (expert, intermediate, novice), and task-success labels (success, recovery, failure).

### 4. Verify Cartesian end-effector kinematics

Inspect the `features` in `meta/info.json` and sample the data:

- `action` and `observation.state` must hold absolute Cartesian end-effector kinematics laid out `[x_m, y_m, z_m, qx, qy, qz, qw, gripper]` per arm; multi-arm platforms (e.g., dVRK PSM1 + PSM2) concatenate one block per arm.
- `action` is the commanded positional setpoint (target pose and gripper angle), not a velocity; `observation.state` is the measured pose.
- Sanity-check values: positions in plausible meters, quaternions near unit norm, signals varying over time. An `observation.state` filled with zeros or a constant is not real kinematics.
- Joint-space kinematics, if present, belong at `observation.meta.joint_positions` (auxiliary), never concatenated into `observation.state`.
- Video-only submissions with inferred poses are considered case-by-case: verify the claimed pose accuracy and derivation method are documented in `meta/README.md`, and flag the submission for steering review instead of a hard pass/fail.

### 5. Compute hours and compare against minimums

Hours = `total_frames / fps / 3600`, both read from `meta/info.json`. Cross-check against the total hours stated in `meta/README.md`. Compare against the per-setting hour minimums in the RFP (`assets/open-h-rfp.pdf`, Section 4.3); read them from the RFP at review time, never from memory, and never copy the RFP tables into other documents. The RFP is a PDF, so extract its text first (see "Reading the RFP" in `AGENTS.md`). Report hours as the measure of contribution; a trajectory count may be included as supplementary context only.

### 6. Confirm this is not raw unlabeled video

Raw, unlabeled video is not accepted. If the dataset contains only `observation.images.*` streams with no state, action, or pose signals, it does not qualify, unless it is a documented inferred-pose case (step 4) flagged for steering review. Every episode needs task text stating the task and target (in the per-episode task and `instruction.text` where present), never a generic label.

### 7. Produce the review

Verdict is one of: **accept**, **accept-with-fixes**, **needs-work**.

- accept: validator clean, all metadata present, kinematics and hours verified.
- accept-with-fixes: no structural blockers, but specific items must be corrected (list them with exact instructions).
- needs-work: validator errors, missing required metadata, missing or fake Cartesian kinematics, raw unlabeled video, or hours below the applicable minimum.

## Reporting format

```markdown
# Submission Review: <dataset name>

- Dataset path: <path>
- Reviewed: <date>
- Verdict: accept | accept-with-fixes | needs-work

## Summary
- Hours (computed): <X.X> h  (claimed: <Y.Y> h)
- Collection setting: <setting>; RFP minimum for this setting: see assets/open-h-rfp.pdf Section 4.3
- Cartesian EE kinematics: verified | not verified | inferred-pose (steering review)
- Validator: <E> errors, <W> warnings

## Findings
| # | Check | Status | Details | Required fix |
|---|-------|--------|---------|--------------|
| 1 | Validator | pass/fail | ... | ... |
| 2 | v3.0 layout + meta/README.md | pass/fail | ... | ... |
| 3 | Required metadata | pass/fail | ... | ... |
| 4 | Cartesian EE kinematics | pass/fail | ... | ... |
| 5 | Hours vs minimum | pass/fail | ... | ... |
| 6 | Not raw unlabeled video | pass/fail | ... | ... |

## Fix instructions
1. <concrete, ordered steps the contributor should take>
```

Style notes for the review text: initiative names hyphenated (Open-H-Hospital); hours, not trajectory or episode counts, as the measure of contribution. Technical questions: Nigel Nelson, nigeln@nvidia.com.
