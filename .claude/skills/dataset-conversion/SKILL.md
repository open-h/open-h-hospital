---
name: dataset-conversion
description: Help a contributor convert healthcare robotics data (HDF5, Zarr, ROS bags, CSV plus frames) into the LeRobot v3.0 dataset format accepted by Open-H-Hospital. Use when asked to convert, format, or prepare data for submission.
---

# Dataset Conversion

Convert contributor source data into a LeRobot format v3.0 dataset ready for Open-H-Hospital submission. Use the pinned package `lerobot[dataset]==0.6.0` (Python >= 3.12; the `[dataset]` extra is required, and the package version and the dataset format version are separate versioning schemes). Target layout: `meta/info.json` (codebase_version "v3.0"), `meta/stats.json`, `meta/tasks.parquet`, `meta/episodes/chunk-*/file-*.parquet`, data files that aggregate multiple episodes at `data/chunk-*/file-*.parquet`, and videos at `videos/<camera_key>/chunk-*/file-*.mp4`.

## Procedure

### 1. Inventory the source data

Establish before writing any code: directory layout and file formats; the streams present (video, kinematics, force/torque, medical imaging, labels, language); sample rate of each stream; timestamp representation (units, epoch vs relative, clock source, dtype); physical units of state and action channels; and how episode boundaries are defined (one file per episode, an `episode_ends` array, bag boundaries, or something else).

### 2. Establish synchronization

Streams must share a common relative time base before conversion. Use `scripts/synchronization/` and the offset-then-sync pattern:

- `rosbag_parsing.py`: extract per-topic timestamps and values from ROS1 bags.
- `temp_cali.py`: estimate the constant time offset between two streams by sine-fitting a shared periodic motion (worked example: ultrasound images vs the robot's end-effector pose while compressing a phantom).
- `post_sync.py`: apply per-stream offsets, then align messages across streams within a slop tolerance.

Two timelines apply. (1) The canonical LeRobot `timestamp` column is the FRAME timeline: the library always writes `frame_index / fps` and does not accept explicit per-frame values, so streams must be captured or resampled at a fixed rate before conversion, which is what this synchronization step must deliver. (2) Ground-truth capture clocks are preserved losslessly as the pass-through feature `observation.meta.host_stamp_ns` (int64, Unix-epoch nanoseconds, one per frame; see the converters for the pattern). Beware unit mixups in sources (ROS `header.stamp` and many device SDKs are nanoseconds; others are seconds): convert to int64 nanoseconds for the meta feature.

### 3. Choose or adapt a converter

From `scripts/conversion/`, by source layout:

- `hdf5_to_lerobot.py`: a directory of HDF5 files, one episode per file.
- `zarr_to_lerobot.py`: a single Zarr store with flat concatenated arrays and an `episode_ends` boundary array.
- `dvrk_zarr_to_lerobot.py`: dVRK-style directory structures with multiple cameras (stereo endoscope, wrist), recovery demonstrations, and surgical tool metadata.
- `custom_lerobot_split.py`: reference for writing custom splits (recovery, failure).
- ROS bags: parse and synchronize with `scripts/synchronization/`, then feed frames through the HDF5-style episode loop.
- CSV plus image frames: load CSV columns as state/action arrays, frames as the camera stream, then reuse the same episode loop.

Adapt the feature mapping and dataset creation parameters; see `scripts/conversion/README.md` for `image_writer_processes` / `image_writer_threads` performance tuning.

### 4. Map streams to the feature-naming conventions

- `action` (required): commanded absolute Cartesian end-effector setpoints, `[x_m, y_m, z_m, qx, qy, qz, qw, gripper]` per arm; multi-arm platforms (e.g., dVRK PSM1 + PSM2) concatenate one block per arm. Positional setpoints (target poses and gripper angles), not velocities.
- `observation.state` (required): the measured Cartesian end-effector pose, same layout. Native Cartesian end-effector kinematics are required for all submitted datasets; if the source records only joint space, derive the Cartesian pose via forward kinematics (URDF or DH parameters) before conversion.
- `observation.meta.joint_positions`: optional joint-space kinematics. Auxiliary streams live under `observation.meta.<field>` and are never concatenated into `observation.state`.
- `observation.images.<view>`: each camera stream (examples: `observation.images.room`, `observation.images.wrist`, `observation.images.ultrasound`; stereo dVRK: `observation.images.endoscope.left`).
- `observation.meta.<field>`: per-frame metadata (examples: `observation.meta.tool`, `observation.meta.probe_type`, `observation.meta.probe_acquisition_param`, `observation.meta.force_torque`). Camera extrinsics such as `observation.meta.tpv_cali_mtx` are encouraged where available; hand-eye calibration is not required.
- Camera intrinsics: static, so store them once as a file, `meta/calibration/camera_intrinsics.json`, keyed by camera feature name (OpenCV pinhole `fx`/`fy`/`cx`/`cy` in pixels, resolution, distortion model and coefficients), NOT a per-frame feature. Static, dataset-level calibration lives in `meta/calibration/` files; per-frame signals stay as `observation.meta.*` features. Encouraged for calibrated optical cameras (needed for depth, 3D, and stereo); see `write_camera_intrinsics()` in `scripts/conversion/hdf5_to_lerobot.py`. If intrinsics genuinely vary per frame (an optical or digital zoom), store them as a per-frame `observation.meta.camera_intrinsics` feature instead.
- `observation.meta.host_stamp_ns`: ground-truth capture clock, int64 Unix-epoch nanoseconds, one per frame (the canonical `timestamp` column is always `frame_index / fps`; see step 2). Add `observation.meta.<stream>_stamp_ns` variants (e.g., `observation.meta.kinematics_stamp_ns`) for streams captured on their own clocks.
- `instruction.text`: timestep-level language.

Quality bars (suggested): >= 20 Hz, >= 480p, MP4 video encoding.

### 5. Set metadata and splits

- Per-episode task text stating the task and target (examples: "Pass the needle through the tissue phantom and hand it over", "Conduct a liver ultrasound scan"), never a generic label.
- `robot_type` and `fps` in the dataset creation call.
- `tolerance_s` recording the synchronization tolerance (typical 0.1 s).
- Optional but encouraged: first-class `recovery` and `failure` splits alongside train/val/test, recorded as episode-index ranges in `info.json` (see `custom_lerobot_split.py`).

### 6. Source already in LeRobot v2.1

Do not write a converter. Use the official conversion script that ships with LeRobot 0.6.0 (for local-only datasets add `--root <dataset_dir> --push-to-hub false`, where `--root` is the dataset directory ITSELF, the folder containing `meta/`, `data/`, `videos/`; conversion is in place, original preserved as a sibling `<name>_old`):

```bash
python -m lerobot.scripts.convert_dataset_v21_to_v30 --repo-id <id>
```

Before converting, drop or declare any parquet columns not listed in `meta/info.json` features (undeclared columns make the converted dataset unloadable), and note the converter does not carry over `meta/README.md` or `meta/calibration/`; add those after conversion.

v2.1 artifacts (`episodes.jsonl`, `episodes_stats.jsonl`, `tasks.jsonl`, `data/chunk-*/episode_*.parquet`) must not remain in the output.

### 7. Complete the dataset README

Fill out `templates/dataset_template.md` and place it as `README.md` inside the dataset's `meta/` directory. The synchronization section (method, per-stream sample rates, measured skew) is required, as are task group and demonstrated tasks, robotic platform, collection setting, total hours, and licence and de-identification status.

### 8. Validate and iterate

```bash
python scripts/validation/validate_formatting.py <dataset_path> --verbose
```

Fix every ERROR and rerun until the report is clean; address WARNINGs where practical.

## Common pitfalls

- **Absolute epoch timestamps in the canonical column**: `timestamp` values near 1.7e9 are Unix epoch, not the relative frame timeline, a symptom of a hand-rolled writer. Datasets written through `LeRobotDataset.add_frame` get `frame_index / fps` automatically; epoch clocks belong in `observation.meta.host_stamp_ns`.
- **float32 timestamps**: float32 keeps only ~7 significant digits, so epoch-scale values lose all sub-second precision and per-frame deltas collapse to zero. This is why ground-truth clocks are stored as int64 nanoseconds in the meta feature, never in the float32 `timestamp` column.
- **Nanosecond/second unit mixups**: know the unit of every source clock before converting to the int64-ns meta feature; a canonical `timestamp` column 1e9 times too large makes video frame lookup select frame 0 forever.
- **Non-ASCII feature keys**: feature names must be plain ASCII, dot-separated, exactly matching the conventions in step 4; smart quotes or accented characters break loaders.
- **Joint-only kinematics**: v2 requires absolute Cartesian end-effector kinematics in `action` and `observation.state`. Joint-space data alone does not qualify; derive the Cartesian pose via forward kinematics before conversion and keep the joints at `observation.meta.joint_positions`.
- **Raw unlabeled video**: not accepted. Every episode needs task text stating the task and target. Video-only sources with inferred poses are a case-by-case exception decided by steering review, with the pose accuracy and derivation method documented in `meta/README.md`.

Technical questions: Nigel Nelson, nigeln@nvidia.com.
