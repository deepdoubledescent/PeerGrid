import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, getProjectTypes, getLocations, getInstitutes, getTopics, getSkills } from "./Controller";

const uuid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

export function CreatableTagInput({
  label,
  placeholder,
  selectedItems,
  suggestions,
  accentClass,
  inputValue,
  onInputChange,
  onAddItem,
  onRemoveItem,
  disabled,
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizedSelected = selectedItems.map((item) => item.toLowerCase());
  const filteredSuggestions = suggestions
    .map((item) => item?.label ?? item)
    .filter(Boolean)
    .filter((item) => item.toLowerCase().includes(inputValue.trim().toLowerCase()))
    .filter((item) => !normalizedSelected.includes(item.toLowerCase()))
    .slice(0, 8);

  const commitValue = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    onAddItem(cleaned);
    onInputChange("");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitValue(inputValue);
    } else if (e.key === "Backspace" && !inputValue && selectedItems.length > 0) {
      onRemoveItem(selectedItems[selectedItems.length - 1]);
    }
  };

  return (
    <div className="relative">
      <label className="text-xs uppercase tracking-widest text-stone-500">{label}</label>

      <div className="mt-1 min-h-[46px] w-full rounded border border-stone-300 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {selectedItems.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${accentClass}`}
            >
              {item}
              <button
                type="button"
                className="text-stone-500 hover:text-stone-800"
                onClick={() => onRemoveItem(item)}
                disabled={disabled}
              >
                ✕
              </button>
            </span>
          ))}

          <input
            className="min-w-[180px] flex-1 border-0 p-0 outline-none focus:outline-none"
            value={inputValue}
            onChange={(e) => {
              onInputChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedItems.length === 0 ? placeholder : "Add another and press Enter"}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="mt-1 text-xs text-stone-400">
        Pick an existing value from the list or type a new one and press Enter.
      </div>

      {showSuggestions && (filteredSuggestions.length > 0 || inputValue.trim()) && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-sm border border-stone-200 bg-white shadow-lg">
          {filteredSuggestions.map((item) => (
            <li
              key={item}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitValue(item)}
              className="cursor-pointer border-b border-stone-100 px-3 py-2 text-stone-700 hover:bg-stone-100 last:border-0"
            >
              {item}
            </li>
          ))}

          {inputValue.trim() && !filteredSuggestions.some((item) => item.toLowerCase() === inputValue.trim().toLowerCase()) && !normalizedSelected.includes(inputValue.trim().toLowerCase()) && (
            <li
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitValue(inputValue)}
              className="cursor-pointer px-3 py-2 text-stone-700 hover:bg-stone-100"
            >
              Add “{inputValue.trim()}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function NewProjectPage({ user }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [institute, setInstitute] = useState("");
  const [location, setLocation] = useState("");

  const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
  const [instituteSuggestions, setInstituteSuggestions] = useState([]);

  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  const [topicsCatalog, setTopicsCatalog] = useState([]);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const topics = useMemo(() => selectedTopics, [selectedTopics]);
  const skills = useMemo(() => selectedSkills, [selectedSkills]);

  const [workload, setWorkload] = useState("");

  const [onlyInstitute, setOnlyInstitute] = useState(false);
  const [onlyCity, setOnlyCity] = useState(false);
  const [onlyCountry, setOnlyCountry] = useState(false);

  const [allowedInstitutesInput, setAllowedInstitutesInput] = useState("");
  const allowedInstitutes = useMemo(
    () => allowedInstitutesInput.split(",").map((s) => s.trim()).filter(Boolean),
    [allowedInstitutesInput]
  );

  const [allowedInstituteSuggestions, setAllowedInstituteSuggestions] = useState([]);
  const [showAllowedInstituteSuggestions, setShowAllowedInstituteSuggestions] = useState(false);

  const [requiredDocuments, setRequiredDocuments] = useState([]);

  const [projectTypes, setProjectTypes] = useState([]);
  const [selectedProjectTypes, setSelectedProjectTypes] = useState([]);
  const [loadingProjectTypes, setLoadingProjectTypes] = useState(false);

  const addRequiredDoc = () => {
    setRequiredDocuments((prev) => [
      ...prev,
      { id: uuid(), label: "", type: "pdf", required: true },
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
    if (!user) return "You need to be logged in to register a project.";
    if (!title.trim()) return "Title is required.";
    if (!shortDescription.trim()) return "Short description is required.";
    if (!longDescription.trim()) return "Long description is required.";
    if (!institute.trim()) return "Institute is required.";
    if (!location.trim()) return "Location is required.";

    const isValidInstitute = instituteSuggestions.some(
      (item) => item.label === institute.trim()
    );
    if (!isValidInstitute) {
      return "Please choose a predefined institute.";
    }

    const invalidAllowedInstitute = allowedInstitutes.find(
      (inst) => !allowedInstituteSuggestions.some((item) => item.label === inst)
    );
    if (invalidAllowedInstitute) {
      return `Invalid allowed institute: ${invalidAllowedInstitute}`;
    }

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

  const onSubmit = async () => {
    setStatus({ type: "", message: "" });

    const validationError = validate();
    if (validationError) {
      setStatus({ type: "error", message: validationError });
      return;
    }

    setLoading(true);
    try {
      const newProject = {
        author: user.id,
        title: title.trim(),
        short_description: shortDescription.trim(),
        long_description: longDescription.trim(),
        types: selectedProjectTypes,
        location: location.trim(),
        institute: institute.trim(),
        skills,
        topics,
        workload: workload.trim(),

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

        published: new Date().toISOString().slice(0, 10),
      };

      const created = await createProject(newProject);
      setStatus({ type: "success", message: "Project created successfully." });
      navigate(`/projects/${created.id}`);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to create project. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    if (!user) return true;
    if (loading) return true;
    return false;
  };

  useEffect(() => {
    const loadTopicsAndSkills = async () => {
      try {
        const [topicsResult, skillsResult] = await Promise.all([getTopics(), getSkills()]);
        setTopicsCatalog(topicsResult || []);
        setSkillsCatalog(skillsResult || []);
      } catch (e) {
        console.error("Failed to load topics/skills:", e);
        setTopicsCatalog([]);
        setSkillsCatalog([]);
      }
    };

    loadTopicsAndSkills();
  }, []);

  const addUniqueValue = (setter) => (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;

    setter((prev) =>
      prev.some((item) => item.toLowerCase() === cleaned.toLowerCase())
        ? prev
        : [...prev, cleaned]
    );
  };

  const removeValue = (setter) => (value) => {
    setter((prev) => prev.filter((item) => item !== value));
  };

  useEffect(() => {
    const loadProjectTypes = async () => {
      setLoadingProjectTypes(true);
      try {
        const result = await getProjectTypes();
        setProjectTypes(result || []);
      } catch (e) {
        console.error("Failed to load project types:", e);
        setProjectTypes([]);
      } finally {
        setLoadingProjectTypes(false);
      }
    };

    loadProjectTypes();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!showInstituteSuggestions || loading) return;

      try {
        const rows = await getInstitutes(institute);
        if (!cancelled) {
          setInstituteSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch institute suggestions", error);
        if (!cancelled) {
          setInstituteSuggestions([]);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [institute, showInstituteSuggestions, loading]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!showLocationSuggestions || loading) return;

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
  }, [location, showLocationSuggestions, loading]);

  useEffect(() => {
    let cancelled = false;

    const lastToken = allowedInstitutesInput.split(",").pop()?.trim() || "";

    const timer = setTimeout(async () => {
      if (!showAllowedInstituteSuggestions || loading) return;

      try {
        const rows = await getInstitutes(lastToken);
        if (!cancelled) {
          setAllowedInstituteSuggestions(rows || []);
        }
      } catch (error) {
        console.error("Failed to fetch allowed institute suggestions", error);
        if (!cancelled) {
          setAllowedInstituteSuggestions([]);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [allowedInstitutesInput, showAllowedInstituteSuggestions, loading]);

  const handleInstituteSelect = (value) => {
    setInstitute(value);
    setShowInstituteSuggestions(false);
  };

  const handleLocationSelect = (value) => {
    setLocation(value);
    setShowLocationSuggestions(false);
  };

  const handleAllowedInstituteSelect = (value) => {
    const parts = allowedInstitutesInput
      .split(",")
      .map((s) => s.trim());

    parts[parts.length - 1] = value;

    const nextValue = parts.filter(Boolean).join(", ");
    setAllowedInstitutesInput(nextValue ? `${nextValue}, ` : "");
    setShowAllowedInstituteSuggestions(false);
  };

  const handleToggleProjectType = (typeName) => {
    setSelectedProjectTypes((prev) =>
      prev.includes(typeName)
        ? prev.filter((t) => t !== typeName)
        : [...prev, typeName]
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Register New Project</h1>
        </div>
      </div>

      {status.message && (
        <div
          className={`mt-6 p-4 border rounded text-sm ${
            status.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : status.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-stone-50 border-stone-200 text-stone-700"
          }`}
        >
          {status.message}
        </div>
      )}

      {!user && (
        <div className="mt-6 p-4 border border-stone-200 rounded bg-stone-50 text-stone-700">
          You need to be logged in to register a project.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6">
        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Title</label>
          <input
            className="txt-input w-full border border-stone-300"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (status.type === "error") setStatus({ type: "", message: "" });
            }}
            placeholder="Project title"
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Short description</label>
          <textarea
            className="txt-input w-full border border-stone-300 min-h-[80px]"
            value={shortDescription}
            onChange={(e) => {
              setShortDescription(e.target.value);
              if (status.type === "error") setStatus({ type: "", message: "" });
            }}
            placeholder="One-paragraph summary"
            disabled={loading}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-stone-500">Long description</label>
          <textarea
            className="txt-input w-full border border-stone-300 min-h-[180px]"
            value={longDescription}
            onChange={(e) => {
              setLongDescription(e.target.value);
              if (status.type === "error") setStatus({ type: "", message: "" });
            }}
            placeholder="Full project description"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-widest text-stone-500">
            Project Types
          </label>

          {loadingProjectTypes ? (
            <div className="text-sm opacity-60">Loading project types...</div>
          ) : projectTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {projectTypes.map((type) => {
                const typeName = type.type_name;
                const isSelected = selectedProjectTypes.includes(typeName);

                return (
                  <button
                    key={type.type_id}
                    type="button"
                    onClick={() => handleToggleProjectType(typeName)}
                    className={`tag-ghost ${isSelected ? "bg-black text-white" : ""}`}
                  >
                    {typeName}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm opacity-60">No project types available</div>
          )}

          <div className="text-xs opacity-60">
            Optional. You can select none, one, or multiple project types.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Institute</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={institute}
              onChange={(e) => {
                setInstitute(e.target.value);
                setShowInstituteSuggestions(true);
                if (status.type === "error") setStatus({ type: "", message: "" });
              }}
              onFocus={() => setShowInstituteSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowInstituteSuggestions(false), 150);
              }}
              placeholder="Institute name"
              disabled={loading}
            />

            {showInstituteSuggestions && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {instituteSuggestions.length > 0 ? (
                  instituteSuggestions.map((item) => (
                    <li
                      key={item.id ?? item.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleInstituteSelect(item.label)}
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
          </div>

          <div className="relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">Location</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setShowLocationSuggestions(true);
                if (status.type === "error") setStatus({ type: "", message: "" });
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowLocationSuggestions(false), 150);
              }}
              placeholder="City, Country or Country"
              disabled={loading}
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

          <CreatableTagInput
            label="Topics"
            placeholder="Select or create topics"
            selectedItems={selectedTopics}
            suggestions={topicsCatalog.map((item) => item.topic_name)}
            accentClass="border-yellow-300 bg-yellow-50 text-stone-800"
            inputValue={topicInput}
            onInputChange={setTopicInput}
            onAddItem={addUniqueValue(setSelectedTopics)}
            onRemoveItem={removeValue(setSelectedTopics)}
            disabled={loading}
          />

          <CreatableTagInput
            label="Skills"
            placeholder="Select or create skills"
            selectedItems={selectedSkills}
            suggestions={skillsCatalog.map((item) => item.skill_name)}
            accentClass="border-green-300 bg-green-50 text-stone-800"
            inputValue={skillInput}
            onInputChange={setSkillInput}
            onAddItem={addUniqueValue(setSelectedSkills)}
            onRemoveItem={removeValue(setSelectedSkills)}
            disabled={loading}
          />

          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-widest text-stone-500">Workload</label>
            <input
              className="txt-input w-full border border-stone-300"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              placeholder='e.g. "10h/week", "Flexible"'
              disabled={loading}
            />
          </div>
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="text-sm font-semibold mb-3">Visibility</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyInstitute}
                onChange={(e) => setOnlyInstitute(e.target.checked)}
                disabled={loading}
              />
              Only people from my institute can see this project
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyCity}
                onChange={(e) => setOnlyCity(e.target.checked)}
                disabled={loading}
              />
              Only people from my city can see this project
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyCountry}
                onChange={(e) => setOnlyCountry(e.target.checked)}
                disabled={loading}
              />
              Only people from my country can see this project
            </label>
          </div>

          <div className="mt-4 relative">
            <label className="text-xs uppercase tracking-widest text-stone-500">
              Only people from these institutes can see this project (comma-separated)
            </label>
            <input
              className="txt-input w-full border border-stone-300"
              value={allowedInstitutesInput}
              onChange={(e) => {
                setAllowedInstitutesInput(e.target.value);
                setShowAllowedInstituteSuggestions(true);
              }}
              onFocus={() => setShowAllowedInstituteSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowAllowedInstituteSuggestions(false), 150);
              }}
              placeholder="Select institutes"
              disabled={loading}
            />

            {showAllowedInstituteSuggestions && (
              <ul className="absolute w-full z-20 bg-white border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg rounded-sm">
                {allowedInstituteSuggestions.length > 0 ? (
                  allowedInstituteSuggestions.map((item) => (
                    <li
                      key={item.id ?? item.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAllowedInstituteSelect(item.label)}
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
              If you fill this list, users must belong to one of these predefined institutes to view the project.
            </div>
          </div>
        </div>

        <div className="p-4 border border-stone-200 rounded">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Additional required documents</div>
              <div className="text-xs text-stone-500 mt-1">
                Applicants will be asked to submit these when applying.
              </div>
            </div>
            <button
              className="btn-outline"
              type="button"
              onClick={addRequiredDoc}
              disabled={loading}
            >
              + Add document
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {requiredDocuments.length === 0 ? (
              <div className="text-sm text-stone-500">No additional documents required.</div>
            ) : (
              requiredDocuments.map((d) => (
                <div key={d.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6">
                    <input
                      className="txt-input w-full border border-stone-300"
                      placeholder="Document label (e.g. CV, transcript)"
                      value={d.label}
                      onChange={(e) => updateRequiredDoc(d.id, { label: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <select
                      className="txt-input w-full border border-stone-300"
                      value={d.type}
                      onChange={(e) => updateRequiredDoc(d.id, { type: e.target.value })}
                      disabled={loading}
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
                        disabled={loading}
                      />
                      Required
                    </label>
                  </div>

                  <div className="md:col-span-1 flex md:justify-end">
                    <button
                      className="btn-outline"
                      type="button"
                      onClick={() => removeRequiredDoc(d.id)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            className="btn-outline"
            type="button"
            onClick={() => navigate("/projects")}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className="btn-primary"
            type="button"
            disabled={isSubmitDisabled()}
            onClick={onSubmit}
          >
            {loading ? "Creating..." : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}