/* =========================================================================
 * Open-H-Hospital — Dataset Explorer
 * Loads rows from assets/static/data/table_rows.json and renders a
 * filterable, sortable table with per-row and bulk `hf download` commands
 * and directory-level Hugging Face links.
 * ====================================================================== */
(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────
  const DATA_URL = "assets/static/data/table_rows.json";
  const HF_REPO = "nvidia/PhysicalAI-Robotics-Open-H-Embodiment";
  const HF_BASE = "https://huggingface.co/datasets/" + HF_REPO;
  const HF_TREE = HF_BASE + "/tree/main/";
  const HF_BLOB = HF_BASE + "/blob/main/";
  const THUMB_DIR = "assets/static/images/dataset_thumbnails/";

  // ── Presentation labels ───────────────────────────────────────────
  const GROUP_DISPLAY = {
    "Hong Kong Polytechnic University": "HK PolyU",
    "Johns Hopkins University": "JHU",
    "Hamlyn Centre, Imperial College London": "Hamlyn",
    "UC San Diego": "UCSD",
    "CMR Surgical": "CMR Surg.",
    "Rob Surgical": "Rob Surg.",
    "Moon Surgical": "Moon Surg.",
    "PolyU-led consortium": "HK PolyU",
    "USTC + Tuodao": "USTC/Tuodao",
    "Virtual Incision": "Virtual Inc.",
  };

  const DOMAIN_DISPLAY = {
    surgical: "Surgical",
    ultrasound: "Ultrasound",
    endoscopy: "Endoscopy",
  };

  const ENV_DISPLAY = {
    simulation: "Simulation",
    tabletop: "Benchtop",
    phantom: "Phantom",
    clinical: "Clinical",
    ex_vivo: "Ex vivo",
    in_vivo: "In vivo",
  };

  const ROBOT_DISPLAY = {
    "Simulated KUKA Med14": "Sim. KUKA Med14",
    "Simulated Ultrasound Platform": "Sim. US Platform",
    "Simulated dVRK": "Sim. dVRK",
    "Custom 2-Motor Endoscopy Robot": "Custom Endo. Robot",
    "Flexible Endoscope Research Platform": "Flex. Endo. Platform",
    "SonoGym Synthetic Policy": "Sim. KUKA Med14",
    "Manual Laparoscopic Tools": "Manual Lap. Tools",
    "Freehand Ultrasound Probe": "Freehand US Probe",
    "XR Simulator": "XR Simulator",
  };

  const PROCEDURE_DISPLAY = {
    camera_and_view_management: "Camera/View Mgmt.",
    cholecystectomy: "Cholecystectomy",
    colonoscopy: "Colonoscopy",
    endoscopic_ultrasound: "Endoscopic US",
    flexible_endoscopy: "Flexible Endoscopy",
    hernia_repair: "Hernia Repair",
    hysterectomy: "Hysterectomy",
    misc_benchtop_tasks: "Benchtop Tasks",
    mixed_clinical_procedures: "Clinical Procedures",
    prostatectomy: "Prostatectomy",
    resection_and_dissection: "Resection/Dissection",
    robotic_ultrasound: "Robotic US",
    skills_benchmark: "Skills Benchmark",
    surgical_video_understanding: "Surgical Video",
    suturing_and_knot_tying: "Suturing/Knot Tying",
    tissue_manipulation: "Tissue Manipulation",
    ultrasound_guided_intervention: "US-Guided Intervention",
  };

  const TASK_DISPLAY = {
    anatomy_localization: "Anatomy Localization",
    camera_guidance: "Camera Guidance",
    cholecystectomy: "Cholecystectomy",
    colonoscope_navigation: "Colonoscope Nav.",
    debridement: "Debridement",
    endoscope_navigation: "Endoscope Nav.",
    gauze_cutting: "Gauze Cutting",
    grasping: "Grasping",
    hemicolectomy: "Hemicolectomy",
    hernia_repair: "Hernia Repair",
    hysterectomy: "Hysterectomy",
    knot_tying: "Knot Tying",
    lesion_tracking: "Lesion Tracking",
    liver_dissection: "Liver Dissection",
    needle_handover: "Needle Handover",
    needle_insertion: "Needle Insertion",
    needle_pickup: "Needle Pickup",
    "needle pickup": "Needle Pickup",
    peg_transfer: "Peg Transfer",
    prostatectomy: "Prostatectomy",
    robotic_ultrasound_scan: "US Scan",
    roi_tracking: "ROI Tracking",
    surgical_video_annotation: "Annotation",
    suturing: "Suturing",
    tissue_lifting: "Lifting",
    tissue_retraction: "Retraction",
    tool_tracking: "Tool Tracking",
    tracked_endoscopic_ultrasound: "Tracked EUS",
    tracked_ultrasound: "Tracked US",
    ultrasound_guidance: "US Guidance",
    ultrasound_navigation: "US Navigation",
    spatial_navigation: "Spatial Navigation",
    ring_transfer: "Ring Transfer",
    wire_chasing: "Wire Chasing",
    dissection: "Dissection",
    needle_positioning: "Needle Positioning",
    probe_placement: "Probe Placement",
  };

  // Collection method (operator_mode)
  const COLLECTION_DISPLAY = {
    teleoperation: "Teleoperation",
    human_operation: "Manual (human-operated)",
    direct_manual_operation: "Direct manual operation",
    companipulation: "Co-manipulation",
    programmatic: "Programmatic",
    simulation_recording: "Simulation recording",
    mixed: "Mixed",
  };

  // Dataset curation is baked into table_rows.json; this file only renders
  // rows and applies presentation labels.

  // ── Derived display helpers ────────────────────────────────────────
  function titleize(s) {
    if (!s) return "";
    return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function groupName(r) {
    return GROUP_DISPLAY[r.contributor_cluster] || r.contributor_cluster;
  }

  function domainName(r) {
    return DOMAIN_DISPLAY[r.gt_domain] || r.category || "—";
  }

  function envName(r) {
    return ENV_DISPLAY[r.environment_primary] || titleize(r.environment_primary) || "—";
  }

  function robotName(r) {
    const raw = r.robot_platform || "Unknown";
    return ROBOT_DISPLAY[raw] || raw;
  }

  function taskName(r) {
    const proc = r.procedure_family || "";
    const task = r.task_family || "";
    const procDisp = PROCEDURE_DISPLAY[proc] || titleize(proc);
    const taskDisp = TASK_DISPLAY[task] || titleize(task);
    if (procDisp && taskDisp && procDisp.toLowerCase() !== taskDisp.toLowerCase()) {
      return procDisp + " (" + taskDisp + ")";
    }
    return procDisp || taskDisp || "—";
  }

  // Modality chips for a row.
  const MODALITIES = [
    { key: "has_stereo", label: "Stereo" },
    { key: "has_endoscope", label: "Endoscope" },
    { key: "has_ultrasound", label: "Ultrasound" },
    { key: "has_wrist_camera", label: "Wrist cam" },
    { key: "has_third_person_camera", label: "TPV" },
    { key: "has_multiview", label: "Multiview" },
    { key: "has_depth", label: "Depth" },
    { key: "has_segmentation", label: "Segmentation" },
    { key: "has_language", label: "Language" },
  ];
  const FILTER_MODALITIES = MODALITIES.filter((m) => m.key !== "has_language");

  function modalityList(r) {
    return MODALITIES.filter((m) => r[m.key]).map((m) => m.label);
  }

  function fmtNum(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") {
      if (Number.isInteger(v)) return v.toLocaleString("en-US");
      return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }
    return String(v);
  }

  function fmtHours(v) {
    if (v === null || v === undefined) return "—";
    return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  // ── Download command construction (new `hf` CLI) ───────────────────
  function includePattern(r) {
    return r.dataset_path_relative.replace(/\\/g, "/") + "/*";
  }

  function downloadCommand(paths) {
    // `paths` are already glob patterns from includePattern(); emit verbatim.
    const includes = paths
      .map((p) => '  --include "' + p + '"')
      .join(" \\\n");
    return (
      "hf download " + HF_REPO + " --repo-type dataset \\\n" +
      includes + " \\\n" +
      "  --local-dir ./open-h-embodiment"
    );
  }

  function hfDirUrl(r) {
    // Encode each path segment but keep slashes.
    const encoded = r.dataset_path_relative
      .replace(/\\/g, "/")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return HF_TREE + encoded;
  }

  function hfReadmeUrl(r) {
    // README lives at <dataset_root>/README.md.
    const encoded = r.dataset_path_relative
      .replace(/\\/g, "/")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return HF_BLOB + encoded + "/README.md";
  }

  function thumbUrl(r) {
    return THUMB_DIR + encodeURIComponent(r.dataset_id) + ".jpg";
  }

  // ── State ──────────────────────────────────────────────────────────
  let ALL = []; // processed rows
  let VIEW = []; // current filtered + sorted rows
  let sortKey = "hours";
  let sortDir = -1; // -1 desc, 1 asc

  // Search term
  const SEARCH = { q: "" };

  // Categorical filters: each key holds a Map of value -> "include" | "exclude".
  // Multiple values per category are allowed. Empty map = inactive.
  const CAT_KEYS = ["domain", "robot", "environment",
    "task", "collection", "arms"];
  const catState = {};
  CAT_KEYS.forEach((k) => { catState[k] = new Map(); });

  // Modality tri-state: key -> "include" | "exclude" (absent = neutral)
  const modState = new Map();

  // The option value(s) a given row corresponds to for a category.
  // Robot rows match both a family ("f:…") and a platform ("p:…").
  function rowOptionValues(r, key) {
    switch (key) {
      case "domain": return [r.gt_domain];
      case "environment": return [r.environment_primary];
      case "task": return [r.task_family];
      case "collection": return [r.operator_mode || ""];
      case "arms": return [String(r.robot_arm_count)];
      case "robot": return ["f:" + r.robot_family, "p:" + (r.robot_platform || "Unknown")];
      default: return [];
    }
  }

  // Sort accessors
  const SORT_ACCESSORS = {
    dataset: (r) => r.dataset_name.toLowerCase(),
    group: (r) => groupName(r).toLowerCase(),
    domain: (r) => domainName(r).toLowerCase(),
    task: (r) => taskName(r).toLowerCase(),
    environment: (r) => envName(r).toLowerCase(),
    robot: (r) => robotName(r).toLowerCase(),
    episodes: (r) => r.episodes || 0,
    frames: (r) => r.frames || 0,
    hours: (r) => r.hours || 0,
  };

  // ── Processing pipeline ────────────────────────────────────────────
  function processRows(rawRows) {
    const out = rawRows.map((orig) => Object.assign({}, orig));
    out.sort((a, b) => {
      const ga = a.contributor_cluster.toLowerCase();
      const gb = b.contributor_cluster.toLowerCase();
      if (ga !== gb) return ga < gb ? -1 : 1;
      return a.dataset_name.toLowerCase() < b.dataset_name.toLowerCase() ? -1 : 1;
    });
    // Precompute a lowercased search haystack once per row.
    for (const r of out) {
      r._hay = [
        r.dataset_name, r.dataset_path_relative, r.contributor, r.contributor_cluster,
        groupName(r), domainName(r), taskName(r), robotName(r), envName(r),
        r.robot_platform, r.task_family, r.procedure_family, r.subgroup,
        (r.stream_keys || []).join(" "),
      ].join(" ").toLowerCase();
    }
    return out;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter((v) => v !== null && v !== undefined && v !== "")))
      .sort((a, b) => String(a).localeCompare(String(b)));
  }

  // ── Filtering ──────────────────────────────────────────────────────
  // Within a category: includes are OR'd (row must match at least one
  // included value if any exist); excludes always remove matching rows.
  function catMatch(r, key) {
    const state = catState[key];
    if (!state.size) return true;
    const rowVals = rowOptionValues(r, key);
    const includes = [];
    const excludes = [];
    state.forEach((mode, val) => (mode === "exclude" ? excludes : includes).push(val));

    for (const ex of excludes) {
      if (rowVals.includes(ex)) return false;
    }
    if (includes.length) {
      if (!includes.some((inc) => rowVals.includes(inc))) return false;
    }
    return true;
  }

  function matches(r) {
    for (const key of CAT_KEYS) {
      if (!catMatch(r, key)) return false;
    }
    for (const [key, mode] of modState) {
      const has = !!r[key];
      if (mode === "include" && !has) return false;
      if (mode === "exclude" && has) return false;
    }
    if (SEARCH.q) {
      if (r._hay.indexOf(SEARCH.q) === -1) return false;
    }
    return true;
  }

  function applyFilters() {
    VIEW = ALL.filter(matches);
    const acc = SORT_ACCESSORS[sortKey] || SORT_ACCESSORS.hours;
    VIEW.sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return a.dataset_name.toLowerCase() < b.dataset_name.toLowerCase() ? -1 : 1;
    });
    render();
  }

  // ── Rendering ──────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const tbody = el("de-tbody");
    if (!tbody) return;

    // Summary
    const totEp = VIEW.reduce((s, r) => s + (r.episodes || 0), 0);
    const totHr = VIEW.reduce((s, r) => s + (r.hours || 0), 0);
    el("de-summary").textContent =
      VIEW.length + " of " + ALL.length + " datasets · " +
      fmtNum(totEp) + " episodes · " + fmtHours(totHr) + " hours";

    if (!VIEW.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="de-empty">No datasets match the current filters.</td></tr>';
      updateSortIndicators();
      return;
    }

    const frag = document.createDocumentFragment();
    for (const r of VIEW) {
      const tr = document.createElement("tr");

      const dagger = r.no_gt_kinematics
        ? ' <span class="de-dagger" title="Ground-truth kinematics not included">&dagger;</span>'
        : "";

      const chips = modalityList(r)
        .map((m) => '<span class="de-chip">' + escapeHtml(m) + "</span>")
        .join("");

      tr.innerHTML =
        '<td class="de-dataset">' +
          '<div class="de-ds-cell">' +
            '<a class="de-thumb" href="' + hfDirUrl(r) + '" target="_blank" rel="noopener" title="Browse on Hugging Face">' +
              '<img src="' + thumbUrl(r) + '" alt="" loading="lazy" ' +
              'onerror="this.closest(\'.de-thumb\').classList.add(\'de-thumb-missing\');this.remove();" />' +
            "</a>" +
            '<div class="de-ds-meta">' +
              '<div class="de-ds-name">' + escapeHtml(r.dataset_name) + dagger + "</div>" +
              '<div class="de-ds-path">' + escapeHtml(r.dataset_path_relative) + "</div>" +
            "</div>" +
          "</div>" +
        "</td>" +
        "<td>" + escapeHtml(groupName(r)) + "</td>" +
        '<td><span class="de-domain de-domain-' + escapeHtml(r.gt_domain || "other") + '">' +
          escapeHtml(domainName(r)) + "</span></td>" +
        "<td>" + escapeHtml(taskName(r)) + "</td>" +
        "<td>" + escapeHtml(envName(r)) + "</td>" +
        "<td>" + escapeHtml(robotName(r)) + "</td>" +
        '<td class="de-scale">' +
          '<span class="de-scale-line"><b>' + fmtNum(r.episodes) + "</b> ep</span>" +
          '<span class="de-scale-line">' + fmtNum(r.frames) + " fr</span>" +
          '<span class="de-scale-line">' + fmtHours(r.hours) + " h</span>" +
          (chips ? '<div class="de-chips">' + chips + "</div>" : "") +
        "</td>" +
        '<td class="de-actions">' +
          '<a class="de-act-btn de-hf" href="' + hfDirUrl(r) + '" target="_blank" rel="noopener" title="Browse on Hugging Face">' +
            "&#129303; View</a>" +
          '<a class="de-act-btn de-readme" href="' + hfReadmeUrl(r) + '" target="_blank" rel="noopener" title="Open README.md on Hugging Face">' +
            "&#129303; README.md</a>" +
          '<button class="de-act-btn de-copy" type="button" title="Copy hf download command">' +
            '<span class="de-copy-label">Copy cmd</span></button>' +
        "</td>";

      // Stash the per-row download command; a delegated listener on the
      // tbody handles all copy clicks.
      tr._copyCmd = downloadCommand([includePattern(r)]);

      frag.appendChild(tr);
    }
    tbody.innerHTML = "";
    tbody.appendChild(frag);
    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll("#de-table th[data-sort]").forEach((th) => {
      const k = th.getAttribute("data-sort");
      let base = th.getAttribute("data-label") || th.textContent.replace(/[▲▼↕]/g, "").trim();
      th.setAttribute("data-label", base);
      const arrow = k === sortKey ? (sortDir === 1 ? " ▲" : " ▼") : "";
      const sortState = k === sortKey ? (sortDir === 1 ? "ascending" : "descending") : "none";
      th.innerHTML = base + '<span class="de-sort-arrow">' + arrow + "</span>";
      th.setAttribute("aria-sort", sortState);
      th.setAttribute("aria-label", base + ", sort " + sortState + ". Activate to sort.");
    });
  }

  function sortByHeader(th) {
    const k = th.getAttribute("data-sort");
    if (sortKey === k) {
      sortDir *= -1;
    } else {
      sortKey = k;
      // Numeric columns default to descending, text columns to ascending.
      sortDir = ["episodes", "frames", "hours"].includes(k) ? -1 : 1;
    }
    applyFilters();
  }

  // ── Clipboard ──────────────────────────────────────────────────────
  function copyToClipboard(text, btn, labelSel, original) {
    const done = () => {
      btn.classList.add("copied");
      const lab = btn.querySelector(labelSel);
      if (lab) lab.textContent = "Copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        if (lab) lab.textContent = original;
      }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    done();
  }

  // ── Filter UI wiring ───────────────────────────────────────────────
  // Custom multi-select dropdowns. The menu stays open while options are
  // clicked and only closes on click-away. Each option is tri-state:
  // click once = include (green), twice = exclude (red), thrice = off.
  const dropdowns = []; // { key, refresh } for syncing labels

  function optionGroups(key) {
    if (key === "domain")
      return [{ label: "", options: optList(uniqueSorted(ALL.map((r) => r.gt_domain)), (v) => DOMAIN_DISPLAY[v] || titleize(v)) }];
    if (key === "environment")
      return [{ label: "", options: optList(uniqueSorted(ALL.map((r) => r.environment_primary)), (v) => ENV_DISPLAY[v] || titleize(v)) }];
    if (key === "task")
      return [{ label: "", options: optList(uniqueSorted(ALL.map((r) => r.task_family)), (v) => TASK_DISPLAY[v] || titleize(v)) }];
    if (key === "collection")
      return [{ label: "", options: optList(uniqueSorted(ALL.map((r) => r.operator_mode)), (v) => COLLECTION_DISPLAY[v] || titleize(v)) }];
    if (key === "arms") {
      const counts = Array.from(new Set(ALL.map((r) => r.robot_arm_count).filter((v) => v != null))).sort((a, b) => a - b);
      return [{ label: "", options: counts.map((v) => ({ value: String(v), label: v + (v === 1 ? " arm" : " arms") })) }];
    }
    if (key === "robot") {
      const families = uniqueSorted(ALL.map((r) => r.robot_family));
      const platforms = uniqueSorted(ALL.map((r) => r.robot_platform || "Unknown"));
      return [
        { label: "Categories", options: families.map((v) => ({ value: "f:" + v, label: titleize(v) })) },
        { label: "Specific platforms", options: platforms.map((v) => ({ value: "p:" + v, label: ROBOT_DISPLAY[v] || v })) },
      ];
    }
    return [];
  }

  function optList(values, labelFn) {
    return values.map((v) => ({ value: v, label: labelFn ? labelFn(v) : v }));
  }

  function describeTriState(mode) {
    if (mode === "include") return { state: "included", next: "exclude" };
    if (mode === "exclude") return { state: "excluded", next: "clear" };
    return { state: "not selected", next: "include" };
  }

  function buildDropdown(wrapId, key, placeholder) {
    const wrap = el(wrapId);
    if (!wrap) return;
    wrap.classList.add("de-dd");
    wrap.innerHTML = "";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "de-dd-trigger";
    trigger.innerHTML = '<span class="de-dd-text"></span><span class="de-dd-caret">▾</span>';
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", placeholder + " filter");

    const menu = document.createElement("div");
    menu.id = wrapId + "-menu";
    menu.className = "de-dd-menu";
    trigger.setAttribute("aria-controls", menu.id);

    const groups = optionGroups(key);
    groups.forEach((g) => {
      if (g.label) {
        const gl = document.createElement("div");
        gl.className = "de-dd-grouplabel";
        gl.textContent = g.label;
        menu.appendChild(gl);
      }
      g.options.forEach((opt) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "de-dd-opt";
        item.setAttribute("data-value", opt.value);
        item.setAttribute("data-label", opt.label);
        item.setAttribute("aria-pressed", "false");
        item.innerHTML =
          '<span class="de-dd-mark"></span><span class="de-dd-optlabel">' +
          escapeHtml(opt.label) + "</span>";
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          cycleOption(key, opt.value);
          refresh();
          applyFilters();
        });
        menu.appendChild(item);
      });
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = wrap.classList.contains("open");
      closeAllDropdowns();
      if (!open) setDropdownOpen(wrap, true);
    });
    menu.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setDropdownOpen(wrap, false);
        trigger.focus();
      }
    });

    function refresh() {
      const state = catState[key];
      const txt = trigger.querySelector(".de-dd-text");
      if (!state.size) {
        txt.textContent = placeholder;
        txt.classList.add("is-placeholder");
      } else {
        const inc = [];
        const exc = [];
        state.forEach((mode, val) => (mode === "exclude" ? exc : inc).push(val));
        const parts = [];
        if (inc.length) parts.push(inc.length + " incl");
        if (exc.length) parts.push(exc.length + " excl");
        txt.textContent = parts.join(" · ");
        txt.classList.remove("is-placeholder");
      }
      trigger.setAttribute("aria-label", placeholder + " filter: " + txt.textContent);
      menu.querySelectorAll(".de-dd-opt").forEach((item) => {
        const v = item.getAttribute("data-value");
        const mode = state.get(v);
        const label = item.getAttribute("data-label") || "Option";
        const desc = describeTriState(mode);
        item.classList.toggle("include", mode === "include");
        item.classList.toggle("exclude", mode === "exclude");
        item.setAttribute("aria-pressed", mode ? "true" : "false");
        item.setAttribute("aria-label", label + " is " + desc.state + ". Activate to " + desc.next + ".");
      });
      wrap.classList.toggle("has-selection", state.size > 0);
    }

    dropdowns.push({ key, refresh, wrap });
    refresh();
  }

  function cycleOption(key, value) {
    const state = catState[key];
    const cur = state.get(value);
    if (!cur) state.set(value, "include");
    else if (cur === "include") state.set(value, "exclude");
    else state.delete(value);
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".de-dd.open").forEach((d) => setDropdownOpen(d, false));
  }

  function setDropdownOpen(wrap, open) {
    wrap.classList.toggle("open", open);
    const trigger = wrap.querySelector(".de-dd-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function buildFilters() {
    buildDropdown("de-f-domain", "domain", "All domains");
    buildDropdown("de-f-robot", "robot", "All robots");
    buildDropdown("de-f-env", "environment", "All environments");
    buildDropdown("de-f-task", "task", "All tasks");
    buildDropdown("de-f-collection", "collection", "All methods");
    buildDropdown("de-f-arms", "arms", "Any arm count");

    // Close menus when clicking outside any dropdown.
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".de-dd")) closeAllDropdowns();
    });

    // modality chips — tri-state: neutral -> include -> exclude -> neutral
    const modWrap = el("de-f-modalities");
    if (modWrap) {
      FILTER_MODALITIES.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "de-mod-toggle";
        b.textContent = m.label;
        b.setAttribute("data-key", m.key);
        const updateModalityA11y = () => {
          const desc = describeTriState(modState.get(m.key));
          b.setAttribute("aria-pressed", modState.has(m.key) ? "true" : "false");
          b.setAttribute("aria-label", m.label + " modality is " + desc.state + ". Activate to " + desc.next + ".");
        };
        updateModalityA11y();
        b.addEventListener("click", () => {
          const cur = modState.get(m.key);
          if (!cur) {
            modState.set(m.key, "include");
            b.classList.add("include");
            b.classList.remove("exclude");
          } else if (cur === "include") {
            modState.set(m.key, "exclude");
            b.classList.add("exclude");
            b.classList.remove("include");
          } else {
            modState.delete(m.key);
            b.classList.remove("include", "exclude");
          }
          updateModalityA11y();
          applyFilters();
        });
        modWrap.appendChild(b);
      });
    }

    // listeners
    const onSearch = el("de-search");
    if (onSearch) {
      let t;
      onSearch.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(() => { SEARCH.q = onSearch.value.trim().toLowerCase(); applyFilters(); }, 120);
      });
    }

    // Sort headers
    document.querySelectorAll("#de-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => sortByHeader(th));
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          sortByHeader(th);
        }
      });
    });

    // reset
    const reset = el("de-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        SEARCH.q = "";
        CAT_KEYS.forEach((k) => catState[k].clear());
        modState.clear();
        if (onSearch) onSearch.value = "";
        dropdowns.forEach((d) => d.refresh());
        document.querySelectorAll(".de-mod-toggle").forEach((b) => {
          const label = b.textContent.trim();
          b.classList.remove("include", "exclude");
          b.setAttribute("aria-pressed", "false");
          b.setAttribute("aria-label", label + " modality is not selected. Activate to include.");
        });
        closeAllDropdowns();
        applyFilters();
      });
    }

    // bulk copy
    const bulk = el("de-bulk-copy");
    if (bulk) {
      bulk.addEventListener("click", () => {
        if (!VIEW.length) return;
        const cmd = downloadCommand(VIEW.map(includePattern));
        copyToClipboard(cmd, bulk, ".de-bulk-label", "Copy download command for all filtered");
      });
    }
  }

  // ── Init ───────────────────────────────────────────────────────────
  let loaded = false; // guards the one-time data fetch

  // Fetch + render the dataset index. No-ops after the first call, so it is
  // safe to invoke on every explorer open.
  function loadData() {
    if (loaded) return;
    loaded = true;

    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        ALL = processRows(data.rows || []);
        buildFilters();
        applyFilters();
      })
      .catch((err) => {
        loaded = false; // allow a retry on the next open
        console.error("Dataset explorer failed to load:", err);
        const tbody = el("de-tbody");
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="8" class="de-empty">Failed to load dataset index. ' +
            "Please try refreshing the page.</td></tr>";
        }
      });
  }

  function init() {
    const root = el("de-tbody");
    if (!root) return; // explorer markup not present

    // Single delegated copy handler for all rows.
    root.addEventListener("click", function (e) {
      const btn = e.target.closest(".de-copy");
      if (!btn) return;
      const tr = btn.closest("tr");
      if (tr && tr._copyCmd) {
        copyToClipboard(tr._copyCmd, btn, ".de-copy-label", "Copy cmd");
      }
    });

    // Lazy-load: only fetch the index when the explorer view is open
    // (hash === #explorer). Load now if already there, and on hash changes.
    const maybeLoad = () => {
      if (window.location.hash === "#explorer") loadData();
    };
    window.addEventListener("hashchange", maybeLoad);
    maybeLoad();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
