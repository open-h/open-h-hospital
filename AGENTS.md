# AGENTS.md: Operating Guide for AI Agents

## Project Orientation

Open-H-Hospital is an open, multi-institution dataset initiative for healthcare robotics: robotic surgery (dVRK, Raven, Virtual Incision MIRA, CMR Versius), robotic ultrasound (KUKA LBR Med, UR-series, Franka FR3, custom cobots with force-feedback probes), and other healthcare robotics (mobile manipulators, collaborative arms, AMRs). It assembles synchronized, multimodal recordings (video, robot state and action, medical imaging, language) to train vision-language models, vision-language-action models, world-action models, and computer-vision expert models. The first release (v1) gathered roughly 780 hours of synchronized video and kinematics across about 20 robotic platforms and around 50 institutions, and served as the training data for the GR00T-H vision-language-action model and the Cosmos-H surgical world model. This repo hosts the v2 effort: a focused push on high-quality, richly labeled data, organized in two tracks: Track A (new robotics datasets) and Track B (annotating existing clinical procedure video against a shared surgical ontology). Endoscopic and endoluminal datasets belong to the sibling Open-H-Endoluminal initiative (github.com/open-h/open-h-endoluminal). This repo is the contributor-facing home: the contribution guide, the v2 RFP, conversion, synchronization, and validation scripts, the dataset README template, the GitHub Pages dataset explorer, and agent skills. Datasets standardize on the LeRobot dataset format v3.0 and are released under OpenMDW-1.1; the v1 dataset is live on Hugging Face (nvidia/PhysicalAI-Robotics-Open-H-Embodiment).

## Repo Map

| Path | Purpose |
| :--- | :--- |
| `README.md` | Contribution guide: v2 participation funnel, LeRobot v3.0 install and format requirements, feature conventions, synchronization and conversion examples, validation. |
| `assets/open-h-rfp.pdf` | The v2 RFP, verbatim. Sole authority for tiers, minimums, weights, and timeline. DO NOT MODIFY OR REPLACE (see note below). |
| `templates/dataset_template.md` | Dataset README template; contributors complete a copy as `meta/README.md` inside their dataset. |
| `scripts/conversion/README.md` | Overview of the converters plus video-encoding performance tuning notes. |
| `scripts/conversion/hdf5_to_lerobot.py` | Converts a directory of per-episode HDF5 files to a LeRobot dataset. |
| `scripts/conversion/zarr_to_lerobot.py` | Converts a single Zarr store (episode boundaries via `episode_ends`) to a LeRobot dataset. |
| `scripts/conversion/dvrk_zarr_to_lerobot.py` | Specialized dVRK converter: multi-camera directory structures (stereo endoscope, wrist), recovery demonstrations, surgical tool metadata. |
| `scripts/conversion/custom_lerobot_split.py` | Example of recording custom splits, including recovery and failure splits. |
| `scripts/synchronization/rosbag_parsing.py` | Extracts timestamped scalar signals from selected ROS1 bag topics. |
| `scripts/synchronization/temp_cali.py` | Estimates the temporal offset between two periodic signals via sine-wave fitting. |
| `scripts/synchronization/post_sync.py` | Applies per-topic time offsets and aligns multi-topic messages within a slop tolerance. |
| `scripts/validation/validate_formatting.py` | Local compliance validator; the final check before a dataset is submitted. |
| `environment.yml` | Pinned conda environment (Python 3.12, `lerobot[dataset]==0.6.0`) for the conversion scripts. |
| `index.html` + `assets/static/` | GitHub Pages dataset explorer for the v1 release (open-h.github.io/open-h-embodiment). |
| `ruff.toml` | Lint configuration for the scripts (`ruff check scripts/`). |
| `AGENTS.md` | This file: the operating guide for AI agents working in the repo. |
| `CLAUDE.md` | Pointer that directs Claude Code to this file. |
| `.claude/skills/submission-review/SKILL.md` | Skill: review a contributed dataset for compliance, metadata, kinematics, and hours. |
| `.claude/skills/dataset-conversion/SKILL.md` | Skill: help a contributor convert source data into LeRobot v3.0. |

## Tracks and Contribution Accounting

Participation is organized into two tracks (RFP Section 4); a team may propose to either or both.

- **Track A, robotics data**: synchronized recordings from robotic surgery, robotic ultrasound, or other healthcare robotics. Contributions are measured in HOURS of synchronized data (hours = `total_frames / fps / 3600`), with per-setting hour minimums and relative weights in the RFP. Trajectory counts are supplementary context only (the dataset template records both).
- **Track B, annotations**: labels on existing procedure video following the v2 surgical ontology, which layers temporal segmentation (phase, step, task, action, and gesture), per-frame segmentation masks of anatomy and instruments, motion quality, intent and outcome (success, recovery, failure), and reasoning/narration on synchronized surgical video. Contributions are counted in weighted labels with per-type weights and an overall weighted minimum (RFP Section 4.4). Verbal and action/gesture annotators need at least resident-level medical training or an MD (or equivalent) degree. The initial ontology spans cholecystectomy, inguinal hernia repair, prostatectomy, and hysterectomy. This repo's scripts and skills are Track-A tooling; Track B runs on the hosted annotation platform.

## Collection-Setting Vocabulary

In preference order: clinical (human), in-vivo (animal), ex-vivo (isolated tissue samples), phantom / table-top, simulation (digital). Per-setting hour minimums and relative weights live in the RFP (`assets/open-h-rfp.pdf`, Section 4.3); Track B label weights are in Section 4.4. READ the numbers from the RFP at need, never duplicate its tables (they would go stale). The RFP is a PDF; extract its text first (see "Reading the RFP" below).

## Kinematics Policy

- Native Cartesian end-effector kinematics are REQUIRED for all submitted datasets; joint-space kinematics are optional and auxiliary.
- Video-only datasets with inferred poses that demonstrate a high level of accuracy are considered case-by-case; flag them for steering review rather than rejecting outright.
- Raw, unlabeled video is NOT accepted.

## Feature-Naming Conventions

Keep these names identical across the README, template, converters, and validator whenever editing any of them. (Known gap: the README's feature-example snippets and the generic converters still show v1-era joint-state / Euler-action payloads; align them with the Cartesian convention below when next touched.)

- Required features: `action` and `observation.state`, both holding absolute Cartesian end-effector kinematics laid out `[x_m, y_m, z_m, qx, qy, qz, qw, gripper]` per arm; multi-arm platforms (e.g., dVRK PSM1 + PSM2) concatenate one block per arm, with the arm order documented in the feature names. `action` is the commanded setpoint and `observation.state` the measured pose. Actions are positional setpoints (target poses and gripper angles), not velocities.
- Joint-space kinematics (optional): `observation.meta.joint_positions`. Auxiliary streams live under `observation.meta.<field>` and are never concatenated into `observation.state`.
- Camera streams: `observation.images.<view>` (examples: `observation.images.room`, `observation.images.wrist`, `observation.images.ultrasound`; stereo dVRK: `observation.images.endoscope.left`).
- Per-frame metadata: `observation.meta.<field>` (examples: `observation.meta.tool`, `observation.meta.probe_type`, `observation.meta.probe_acquisition_param`, `observation.meta.force_torque`). Camera extrinsics such as `observation.meta.tpv_cali_mtx` are encouraged where available, but hand-eye calibration is not required.
- Camera intrinsics: Store as a file: `meta/calibration/camera_intrinsics.json` (keyed by camera feature name: OpenCV pinhole `fx`/`fy`/`cx`/`cy`, resolution, distortion model and coefficients). The clean split: static, dataset-level calibration lives in `meta/calibration/` files; per-frame signals stay as `observation.meta.*` features. Encouraged for calibrated optical cameras. Reference writer: `write_camera_intrinsics()` in `scripts/conversion/hdf5_to_lerobot.py`.
- Timestep-level language: `instruction.text`.
- Ground-truth capture clocks: `observation.meta.host_stamp_ns` for the reference (video) stream, plus `observation.meta.<stream>_stamp_ns` (e.g., `observation.meta.kinematics_stamp_ns`) for each additional stream captured at its own rate and resampled onto the frame timeline (all int64, Unix-epoch nanoseconds, one per frame). LeRobot's canonical `timestamp` column is always the frame timeline (`frame_index / fps`; the library does not accept explicit per-frame timestamps), so raw hardware stamps are preserved losslessly in these pass-through features. Streams must be captured or resampled at a fixed rate; when resampling to the frame timeline, choose the method by field type: linear interpolation for continuous or positional fields, spherical linear interpolation (Slerp) for quaternion orientation, and zeroth-order hold for categorical or slowly-changing metadata.
- Quality bars (suggested): >= 20 Hz, >= 480p, MP4 video encoding, synchronization tolerance recorded via `tolerance_s` (typical 0.1 s).

## Common Workflows

### Review a submission

Use the `submission-review` skill (`.claude/skills/submission-review/SKILL.md`). In short: run `scripts/validation/validate_formatting.py` on the dataset, check every required metadata item against the RFP, verify Cartesian end-effector kinematics in `action` / `observation.state`, compute hours of synchronized data, and produce a structured review with a verdict and concrete fixes.

### Help a contributor convert data

Use the `dataset-conversion` skill (`.claude/skills/dataset-conversion/SKILL.md`). In short: identify the source layout (HDF5, Zarr, ROS bags, CSV plus frames), establish synchronization with `scripts/synchronization/`, map streams to the feature-naming conventions above, adapt a converter from `scripts/conversion/`, then run the validator and iterate until it passes clean.

## The RFP Is Read-Only

`assets/open-h-rfp.pdf` is the verbatim v2 RFP and the sole authority for collection-setting minimums and weights, Track B label weights, the timeline, and proposal requirements. Agents must not modify, replace, or re-export it. If other documents need numbers that live in the RFP, link to the RFP rather than copying them. The v1 RFP is archived at `assets/open-h-v1-rfp.pdf` for historical reference only.

### Reading the RFP

The RFP is a PDF; extract its text before quoting or comparing numbers:

```bash
pdftotext assets/open-h-rfp.pdf -        # if poppler is installed
```

or, without poppler:

```bash
pip install pypdf
python -c "import pypdf; print('\n'.join(p.extract_text() for p in pypdf.PdfReader('assets/open-h-rfp.pdf').pages))"
```
