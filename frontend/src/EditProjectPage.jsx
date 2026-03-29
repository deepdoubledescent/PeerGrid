import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProject, updateProject, getProjectTypes, getLocations, getTopics, getSkills } from "./Controller";

export default function EditProjectPage({ user }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [project, setProject] = useState(null);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [institute, setInstitute] = useState("");
  const [location, setLocation] = useState("");
  const [workload, setWorkload] = useState("");

  const [topics, setTopics] = useState([]);
  const [skills, setSkills] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [availableTopics, setAvailableTopics] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);

  const [onlyInstitute, setOnlyInstitute] = useState(false);
  const [onlyCity, setOnlyCity] = useState(false);
  const [onlyCountry, setOnlyCountry] = useState(false);

  const [allowedInstitutesInput, setAllowedInstitutesInput] = useState("");
  const allowedInstitutes = useMemo(
    () => allowedInstitutesInput.split(",").map((s) => s.trim()).filter(Boolean),
    [allowedInstitutesInput]
  );

  const [requiredDocuments, setRequiredDocuments] = useState([]);

  const [projectTypes, setProjectTypes] = useState([]);
  const [selectedProjectTypes, setSelectedProjectTypes] = useState([]);

  const [completed, setCompleted] = useState(false);

  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [proj, types, topicsData, skillsData] = await Promise.all([
          getProject(projectId),
          getProjectTypes(),
          getTopics(),
          getSkills(),
        ]);

        if (!proj) {
          setStatus({ type: "error", message: "Project not found." });
          setLoading(false);
          return;
        }

        if (!user || String(user.id) !== String(proj.author)) {
          setStatus({ type: "error", message: "You do not have permission to edit this project." });
          setLoading(false);
          return;
        }

        setProject(proj);
        setProjectTypes(types || []);
        setAvailableTopics((topicsData || []).map((item) => item.topic_name || item.name || item).filter(Boolean));
        setAvailableSkills((skillsData || []).map((item) => item.skill_name || item.name || item).filter(Boolean));

        setTitle(proj.title || "");
        setShortDescription(proj.short_description || "");
        setLongDescription(proj.long_description || "");
        setInstitute(proj.institute || "");
        setLocation(proj.location || proj.country || "");
        setWorkload(proj.workload || "");
        setTopics(proj.topics || []);
        setSkills(proj.skills || []);
        setSelectedProjectTypes(proj.types || []);

        setOnlyInstitute(!!proj.visibility?.onlyInstitute);
        setOnlyCity(!!proj.visibility?.onlyCity);
        setOnlyCountry(!!proj.visibility?.onlyCountry);
        setAllowedInstitutesInput((proj.visibility?.allowedInstitutes || []).join(", "));
        setRequiredDocuments(proj.requiredDocuments || []);
        setCompleted(!!proj.completed);
      } catch (err) {
        console.error(err);
        setStatus({ type: "error", message: "Failed to load project." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId, user]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!showLocationSuggestions || saving) return;

      try {
        const rows = await getLocations(location);
        if (!cancelled) {
          setLocationSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch location suggestions", error);
        if (!cancelled) {
          setLocationSuggestions([]);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [location, showLocationSuggestions, saving]);

  const handleLocationSelect = (value) => {
    setLocation(value);
    setShowLocationSuggestions(false);
  };

  const includesIgnoreCase = (list, value) =>
    list.some((item) => item.toLowerCase() === value.trim().toLowerCase());

  const addTopic = (value) => {
    const normalized = value.trim();
    if (!normalized || includesIgnoreCase(topics, normalized)) return;
    setTopics((prev) => [...prev, normalized]);
    setTopicInput("");
    setShowTopicSuggestions(false);
  };

  const removeTopic = (value) => {
    setTopics((prev) => prev.filter((item) => item.toLowerCase() !== value.toLowerCase()));
  };

  const addSkill = (value) => {
    const normalized = value.trim();
    if (!normalized || includesIgnoreCase(skills, normalized)) return;
    setSkills((prev) => [...prev, normalized]);
    setSkillInput("");
    setShowSkillSuggestions(false);
  };

  const removeSkill = (value) => {
    setSkills((prev) => prev.filter((item) => item.toLowerCase() !== value.toLowerCase()));
  };

  const filteredTopicSuggestions = useMemo(() => {
    const query = topicInput.trim().toLowerCase();
    return availableTopics
      .filter((item) => !includesIgnoreCase(topics, item))
      .filter((item) => !query || item.toLowerCase().includes(query))
      .slice(0, 8);
  }, [availableTopics, topics, topicInput]);

  const filteredSkillSuggestions = useMemo(() => {
    const query = skillInput.trim().toLowerCase();
    return availableSkills
      .filter((item) => !includesIgnoreCase(skills, item))
      .filter((item) => !query || item.toLowerCase().includes(query))
      .slice(0, 8);
  }, [availableSkills, skills, skillInput]);

  const handleToggleProjectType = (typeName) => {
    setSelectedProjectTypes((prev) =>
      prev.includes(typeName)
        ? prev.filter((t) => t !== typeName)
        : [...prev, typeName]
    );
  };

  const addRequiredDoc = () => {
    setRequiredDocuments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", type: "pdf", required: true },
    ]);
  };

  const updateRequiredDoc = (id, patch) => {
    setRequiredDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    );
  };

  const removeRequiredDoc = (id) => {
    setRequiredDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const validate = () => {
    if (!title.trim()) return "Title is required.";
    if (!shortDescription.trim()) return "Short description is required.";
    if (!longDescription.trim()) return "Long description is required.";
    if (!institute.trim()) return "Institute is required.";
    if (!location.trim()) return "Location is required.";
    if (onlyCity && !location.includes(",")) {
      return 'Please choose a city-based location because "Only people from my city" is enabled.';
    }

    const hasEmptyDocLabel = requiredDocuments.some(
      (d) => d.required && !d.label.trim()
    );
    if (hasEmptyDocLabel) {
      return "Please fill in all required document labels (or remove the empty rows).";
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setStatus({ type: "error", message: validationError });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const updatedProject = {
        title: title.trim(),
        short_description: shortDescription.trim(),
        long_description: longDescription.trim(),
        types: selectedProjectTypes,
        location: location.trim(),
        institute: institute.trim(),
        skills,
        topics,
        workload: workload.trim(),
        completed,
        visibility: {
          onlyInstitute,
          onlyCity,
          onlyCountry,
          allowedInstitutes,
        },
        requiredDocuments: requiredDocuments
          .filter((d) => d.label.trim())
          .map((d) => ({
            id: d.id,
            label: d.label.trim(),
            type: d.type,
            required: !!d.required,
          })),
      };

      const updated = await updateProject(projectId, updatedProject);
      navigate(`/projects/${updated.id || projectId}`);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to update project." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 max-w-4xl mx-auto">Loading...</div>;
  }

  if (!project || (user && String(user.id) !== String(project.author))) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-red-600">{status.message || "You do not have permission to edit this project."}</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Edit Project</h1>

      {status.message && (
        <div
          className={`mt-6 p-4 border rounded text-sm ${
            status.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6">
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Title</label>
          <input
            className="txt-input w-full border border-stone-300"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Short description</label>
          <textarea
            className="txt-input w-full border border-stone-300 min-h-[80px]"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Long description</label>
          <textarea
            className="txt-input w-full border border-stone-300 min-h-[180px]"
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-stone-500">
            Project Types
          </label>

          <div className="flex flex-wrap gap-2">
            {projectTypes.map((type) => {
              const typeName = type.type_name;
              const isSelected = selectedProjectTypes.includes(typeName);

              return (
                <button
                  key={type.type_id}
                  type="button"
                  onClick={() => handleToggleProjectType(typeName)}
                  disabled={saving}
                  className={`tag-ghost ${isSelected ? "bg-black text-white" : ""}`}
                >
                  {typeName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">Institute</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={institute}
              onChange={(e) => setInstitute(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Location</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowLocationSuggestions(false), 150);
              }}
              placeholder="City, Country or Country"
              disabled={saving}
            />

            {showLocationSuggestions && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {locationSuggestions.length > 0 ? (
                  locationSuggestions.map((item) => (
                    <li
                      key={`${item.type}-${item.label}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleLocationSelect(item.label)}
                      className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700 border-b border-stone-100 last:border-0"
                    >
                      {item.label}
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-stone-400 italic text-sm">
                    No matches found
                  </li>
                )}
              </ul>
            )}

            <div className="text-xs text-stone-400 mt-1">
              Use either "Country" or "City, Country".
            </div>
          </div>

          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Topics</label>
            <div className="min-h-[46px] w-full rounded border border-stone-300 px-3 py-2 flex flex-wrap gap-2 bg-white">
              {topics.map((topic) => (
                <span key={topic} className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2 py-1 text-sm">
                  {topic}
                  <button
                    type="button"
                    onClick={() => removeTopic(topic)}
                    className="text-stone-500 hover:text-stone-800"
                    disabled={saving}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[140px] outline-none"
                value={topicInput}
                onChange={(e) => {
                  setTopicInput(e.target.value);
                  setShowTopicSuggestions(true);
                }}
                onFocus={() => setShowTopicSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTopicSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTopic(topicInput);
                  }
                }}
                placeholder="Select or type a topic"
                disabled={saving}
              />
            </div>
            {showTopicSuggestions && (filteredTopicSuggestions.length > 0 || topicInput.trim()) && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {filteredTopicSuggestions.map((item) => (
                  <li
                    key={item}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTopic(item)}
                    className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700 border-b border-stone-100 last:border-0"
                  >
                    {item}
                  </li>
                ))}
                {topicInput.trim() && !includesIgnoreCase(availableTopics, topicInput) && !includesIgnoreCase(topics, topicInput) && (
                  <li
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTopic(topicInput)}
                    className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700"
                  >
                    Add “{topicInput.trim()}”
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Skills</label>
            <div className="min-h-[46px] w-full rounded border border-stone-300 px-3 py-2 flex flex-wrap gap-2 bg-white">
              {skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2 py-1 text-sm">
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-stone-500 hover:text-stone-800"
                    disabled={saving}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[140px] outline-none"
                value={skillInput}
                onChange={(e) => {
                  setSkillInput(e.target.value);
                  setShowSkillSuggestions(true);
                }}
                onFocus={() => setShowSkillSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
                placeholder="Select or type a skill"
                disabled={saving}
              />
            </div>
            {showSkillSuggestions && (filteredSkillSuggestions.length > 0 || skillInput.trim()) && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {filteredSkillSuggestions.map((item) => (
                  <li
                    key={item}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSkill(item)}
                    className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700 border-b border-stone-100 last:border-0"
                  >
                    {item}
                  </li>
                ))}
                {skillInput.trim() && !includesIgnoreCase(availableSkills, skillInput) && !includesIgnoreCase(skills, skillInput) && (
                  <li
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSkill(skillInput)}
                    className="px-3 py-2 hover:bg-stone-100 cursor-pointer text-stone-700"
                  >
                    Add “{skillInput.trim()}”
                  </li>
                )}
              </ul>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500">Workload</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="text-sm font-semibold mb-3">Project status</div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              disabled={saving}
            />
            Mark this project as completed
          </label>

          <div className="mt-2 text-xs text-stone-500">
            Completed projects will no longer appear on the Projects page.
          </div>
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="text-sm font-semibold mb-3">Visibility</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyInstitute} onChange={(e) => setOnlyInstitute(e.target.checked)} disabled={saving} />
              Only people from my institute can see this project
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyCity} onChange={(e) => setOnlyCity(e.target.checked)} disabled={saving} />
              Only people from my city can see this project
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyCountry} onChange={(e) => setOnlyCountry(e.target.checked)} disabled={saving} />
              Only people from my country can see this project
            </label>
          </div>

          <div className="mt-4">
            <label className="text-xs uppercase tracking-widest text-stone-500">
              Only people from these institutes can see this project (comma-separated)
            </label>
            <input
              className="txt-input w-full border border-stone-300"
              value={allowedInstitutesInput}
              onChange={(e) => setAllowedInstitutesInput(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Additional required documents</div>
            </div>
            <button className="btn-outline" type="button" onClick={addRequiredDoc} disabled={saving}>
              + Add document
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {requiredDocuments.map((d) => (
              <div key={d.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-6">
                  <input
                    className="txt-input w-full border border-stone-300"
                    value={d.label}
                    onChange={(e) => updateRequiredDoc(d.id, { label: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="md:col-span-3">
                  <select
                    className="txt-input w-full border border-stone-300"
                    value={d.type}
                    onChange={(e) => updateRequiredDoc(d.id, { type: e.target.value })}
                    disabled={saving}
                  >
                    <option value="pdf">PDF</option>
                    <option value="text">Text</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.required}
                      onChange={(e) => updateRequiredDoc(d.id, { required: e.target.checked })}
                      disabled={saving}
                    />
                    Required
                  </label>
                </div>

                <div className="md:col-span-1 flex md:justify-end">
                  <button className="btn-outline" type="button" onClick={() => removeRequiredDoc(d.id)} disabled={saving}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            className="btn-outline"
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="btn-primary"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}