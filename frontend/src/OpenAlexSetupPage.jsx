import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, User, Building2, FileText, Check, X, Loader2, 
  ChevronDown, ChevronUp, ExternalLink, ArrowLeft, GraduationCap,
  Globe, Lightbulb, Sparkles, Mail, ShieldCheck, ArrowRight, CheckCircle
} from "lucide-react";

import { CreatableTagInput } from "./NewProjectPage";

import { 
  suggestOpenAlexProfile, 
  saveManualProfile,
  getInstituteVerificationDomain,
  shareInstituteMailName,
  submitMagicCode,
  getTopics,
  getSkills
} from "./Controller";

// Debounce hook for search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Country list for dropdown
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria", 
  "Bangladesh", "Belgium", "Brazil", "Canada", "Chile", "China", "Colombia",
  "Czech Republic", "Denmark", "Egypt", "Finland", "France", "Germany", "Greece",
  "Hong Kong", "Hungary", "India", "Indonesia", "Iran", "Iraq", "Ireland", 
  "Israel", "Italy", "Japan", "Jordan", "Kenya", "South Korea", "Kuwait",
  "Lebanon", "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand",
  "Nigeria", "Norway", "Pakistan", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa",
  "Spain", "Sweden", "Switzerland", "Taiwan", "Thailand", "Turkey", "UAE",
  "Ukraine", "United Kingdom", "United States", "Vietnam", "Other"
];

// Degree options
const DEGREES = [
  "Bachelor's",
  "Master's",
  "PhD",
  "MD",
  "Postdoc",
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Research Scientist",
  "Research Assistant",
  "Other"
];

export default function OpenAlexSetupPage({ 
  user, 
  setUser, 
  allowSkip = true,
  onComplete 
}) {
  const navigate = useNavigate();
  
  // View state: 'search' | 'manual' | 'verify-prompt' | 'verify-form' | 'verify-code' | 'verify-success'
  const [viewMode, setViewMode] = useState('search');
  
  // OpenAlex search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [expandedProfile, setExpandedProfile] = useState(null);
  
  // Manual form states
  const [manualForm, setManualForm] = useState({
    name: user?.name || "",
    degree: "",
    country: "",
    institution: "",
    interests: [], // Now an array of strings
    skills: []     // Now an array of strings
  });

  // Tag Input States
  const [topicsCatalog, setTopicsCatalog] = useState([]);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [topicInput, setTopicInput] = useState("");
  const [skillInput, setSkillInput] = useState("");

  // Institution Search States
  const [instSearchQuery, setInstSearchQuery] = useState("");
  const [instSearchResults, setInstSearchResults] = useState([]);
  const [isSearchingInst, setIsSearchingInst] = useState(false);
  const [showInstSuggestions, setShowInstSuggestions] = useState(false);
  const debouncedInstSearch = useDebounce(instSearchQuery, 300);
  
  // Skills search states
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillSearchResults, setSkillSearchResults] = useState([]);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  
  // Verification states
  const [verificationDomains, setVerificationDomains] = useState([]); // List of domains
  const [selectedDomain, setSelectedDomain] = useState("");           // The chosen domain
  const [emailPrefix, setEmailPrefix] = useState("");
  const [magicCode, setMagicCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingDomain, setIsLoadingDomain] = useState(false);

  // General states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedSkillSearch = useDebounce(skillSearchQuery, 300);

  // Load Topics and Skills on Mount
  useEffect(() => {
    const loadTopicsAndSkills = async () => {
      try {
        const [topicsResult, skillsResult] = await Promise.all([getTopics(), getSkills()]);
        setTopicsCatalog(topicsResult || []);
        setSkillsCatalog(skillsResult || []);
      } catch (e) {
        console.error("Failed to load topics/skills:", e);
      }
    };
    loadTopicsAndSkills();
  }, []);

  // OpenAlex Institution Search
  const searchInstitutions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setInstSearchResults([]);
      return;
    }
    setIsSearchingInst(true);
    try {
      const response = await fetch(
        `https://api.openalex.org/institutions?search=${encodeURIComponent(query)}&per_page=5&mailto=your-app@example.com`
      );
      if (response.ok) {
        const data = await response.json();
        setInstSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Institution search error:", err);
    } finally {
      setIsSearchingInst(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'manual') searchInstitutions(debouncedInstSearch);
  }, [debouncedInstSearch, searchInstitutions, viewMode]);

  // Tag Helper Functions
  const addUniqueFormValue = (field) => (newValue) => {
    setManualForm(prev => {
      const arr = prev[field] || [];
      if (!arr.includes(newValue)) {
        return { ...prev, [field]: [...arr, newValue] };
      }
      return prev;
    });
  };

  const removeFormValue = (field) => (valueToRemove) => {
    setManualForm(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(v => v !== valueToRemove)
    }));
  };

  // --- Search APIs ---
  const searchOpenAlex = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError("");
    setHasSearched(true);

    try {
      const response = await fetch(
        `https://api.openalex.org/authors?search=${encodeURIComponent(query)}&per_page=10&mailto=your-app@example.com`
      );

      if (!response.ok) throw new Error("Failed to search OpenAlex");

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("OpenAlex search error:", err);
      setError("Failed to search OpenAlex. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const searchKeywords = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSkillSearchResults([]);
      return;
    }

    setIsSearchingSkills(true);

    try {
      const response = await fetch(
        `https://api.openalex.org/keywords?search=${encodeURIComponent(query)}&per_page=15&mailto=your-app@example.com`
      );

      if (!response.ok) throw new Error("Failed to search keywords");

      const data = await response.json();
      setSkillSearchResults(data.results || []);
    } catch (err) {
      console.error("Keywords search error:", err);
      setSkillSearchResults([]);
    } finally {
      setIsSearchingSkills(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'search') searchOpenAlex(debouncedSearch);
  }, [debouncedSearch, searchOpenAlex, viewMode]);

  useEffect(() => {
    if (viewMode === 'manual') searchKeywords(debouncedSkillSearch);
  }, [debouncedSkillSearch, searchKeywords, viewMode]);

  // --- Fetching Domain for Verification ---
  useEffect(() => {
      if (viewMode === 'verify-form') {
        const fetchDomains = async () => {
          setIsLoadingDomain(true);
          setError("");
          try {
            const domains = await getInstituteVerificationDomain();
            
            if (domains && domains.length > 0) {
              setVerificationDomains(domains);
              setSelectedDomain(domains[0]);
            } else {
              // Explicitly set empty array if none are found
              setVerificationDomains([]);
            }
          } catch (err) {
            console.error("Failed to fetch domains:", err);
            setVerificationDomains([]); // Default to empty on failure
          } finally {
            setIsLoadingDomain(false);
          }
        };
        fetchDomains();
      }
    }, [viewMode]);

  // --- OpenAlex Selection ---
  const fetchWorks = async (authorId) => {
    try {
      const response = await fetch(
        `https://api.openalex.org/works?filter=author.id:${authorId}&per_page=5&sort=cited_by_count:desc&mailto=your-app@example.com`
      );
      if (response.ok) {
        const data = await response.json();
        return data.results || [];
      }
    } catch (err) {
      console.error("Failed to fetch works:", err);
    }
    return [];
  };

  const handleProfileExpand = async (profile) => {
    if (expandedProfile === profile.id) {
      setExpandedProfile(null);
      return;
    }
    setExpandedProfile(profile.id);
    if (!profile.works) {
      const works = await fetchWorks(profile.id);
      setSearchResults(prev => 
        prev.map(p => p.id === profile.id ? { ...p, works } : p)
      );
    }
  };

  const handleSelectProfile = (profile) => {
    if (selectedProfile?.id === profile.id) {
      setSelectedProfile(null);
    } else {
      setSelectedProfile(profile);
    }
  };

  const fetchOpenAlexData = async (authorId, openAlexId) => {
    // 1. Fetch top 5 recent papers with abstracts
    const worksResp = await fetch(
      `https://api.openalex.org/works?filter=authorships.author.id:${authorId},has_abstract:true&sort=publication_date:desc&per_page=5&mailto=your-app@example.com`
    );
    const worksData = await worksResp.json();
    const papers = (worksData.results || []).map(work => {
      const workId = work.id.split('/').pop();
      let abstract = null;
      if (work.abstract_inverted_index) {
        const words = [];
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          for (const pos of positions) words[pos] = word;
        }
        abstract = words.join(' ');
      }
      return {
        paper_id: workId,
        title: work.title || null,
        date_published: work.publication_date || null,
        source: work.primary_location?.source?.display_name || null,
        abstract,
        topics: (work.topics || []).map((t, idx) => ({
          topic_id: parseInt(t.id.split('/').pop().replace('T', ''), 10),
          topic_name: t.display_name,
          subfield_name: t.subfield?.display_name || null,
          field_name: t.field?.display_name || null,
          subfield_id: t.subfield?.id ? parseInt(t.subfield.id.split('/').pop().replace('SF', ''), 10) : null,
          field_id: t.field?.id ? parseInt(t.field.id.split('/').pop().replace('F', ''), 10) : null,
          is_primary: idx === 0 ? 1 : 0,
        })),
      };
    });

    // 2. Fetch topic stats
    const topicStatsResp = await fetch(
      `https://api.openalex.org/works?group_by=primary_topic.id&per_page=200&filter=authorships.author.id:${authorId}&mailto=your-app@example.com`
    );
    const topicStatsData = await topicStatsResp.json();
    const topicStats = (topicStatsData.group_by || [])
      .filter(g => g.key && g.key !== 'unknown')
      .map(g => ({
        topic_id: parseInt(g.key.replace('T', ''), 10),
        count: g.count,
      }))
      .filter(g => !isNaN(g.topic_id));

    // 3. Fetch co-authors
    const coauthorResp = await fetch(
      `https://api.openalex.org/works?group_by=authorships.author.id&per_page=200&filter=authorships.author.id:${authorId}&mailto=your-app@example.com`
    );
    const coauthorData = await coauthorResp.json();
    const coauthors = (coauthorData.group_by || [])
      .filter(g => g.key && g.key !== 'unknown')
      .map(g => g.key.split('/').pop())
      .filter(id => id !== openAlexId);

    return { papers, topicStats, coauthors };
  };

  const handleConfirmOpenAlexSelection = async () => {
    if (!selectedProfile) return;
    setIsSubmitting(true);
    setError("");

    try {
      const openAlexId = selectedProfile.id.split('/').pop();
      const { papers, topicStats, coauthors } = await fetchOpenAlexData(
        selectedProfile.id,
        openAlexId
      );

      const openAlexProfile = {
        displayName: selectedProfile.display_name,
        orcid: selectedProfile.orcid || null,
        institution: selectedProfile.last_known_institutions?.[0]?.display_name || null,
        worksCount: selectedProfile.works_count,
        citedByCount: selectedProfile.cited_by_count,
        hIndex: selectedProfile.summary_stats?.h_index,
        i10Index: selectedProfile.summary_stats?.i10_index,
        topTopics: selectedProfile.topics?.slice(0, 5).map(t => ({
          id: t.id,
          name: t.display_name,
          count: t.count,
        })) || [],
      };

      const updatedUser = await suggestOpenAlexProfile(openAlexId, openAlexProfile, papers, topicStats, coauthors);
      
      setUser(updatedUser);
      if (onComplete) await onComplete(updatedUser);
      
      // Changed: Move to Verify Form instead of projects
      console.log("setting view to verify-form");
      setViewMode('verify-form');

    } catch (err) {
      console.error("Error saving OpenAlex profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Manual Entry ---
  const handleManualFormChange = (field, value) => setManualForm(prev => ({ ...prev, [field]: value }));

  const handleAddSkill = (skill) => {
    if (!manualForm.skills.find(s => s.id === skill.id)) {
      setManualForm(prev => ({
        ...prev,
        skills: [...prev.skills, { id: skill.id, display_name: skill.display_name }]
      }));
    }
    setSkillSearchQuery("");
    setSkillSearchResults([]);
  };

  const handleRemoveSkill = (skillId) => {
    setManualForm(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== skillId) }));
  };

  const handleSubmitManualForm = async () => {
    if (!manualForm.institution.trim()) {
      setError("Please enter your institution");
      return;
    }
    if (manualForm.interests.length === 0) {
      setError("Please add at least one research interest");
      return;
    }
    if (manualForm.skills.length === 0) {
      setError("Please add at least one skill or keyword");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const updatedUser = await saveManualProfile(manualForm);
      setUser(updatedUser);
      if (onComplete) await onComplete(updatedUser);
      
      // Changed: Move to Prompt asking if they want to verify
      setViewMode('verify-prompt');
    } catch (err) {
      console.error("Error saving manual profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Verification Methods ---
  const handleRequestMagicCode = async () => {
    if (!emailPrefix.trim()) {
      setError("Please enter your username/prefix.");
      return;
    }
    setIsVerifying(true);
    setError("");
    try {
      // Pass both the prefix and the chosen domain to your controller
      await shareInstituteMailName(emailPrefix.trim(), selectedDomain);
      setViewMode('verify-code');
    } catch (err) {
      setError(err.message || "Failed to send magic code. Please check your username.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyMagicCode = async () => {
    if (!magicCode.trim()) {
      setError("Please enter the code sent to your email.");
      return;
    }
    
    setIsVerifying(true);
    setError("");
    
    try {
      // Now expecting a boolean instead of throwing an error
      const isSuccess = await submitMagicCode(magicCode.trim());
      
      if (isSuccess) {
        setViewMode('verify-success');
      } else {
        setError("Invalid or expired code. Please check your email and try again.");
      }
    } catch (err) {
      // Catch network or server errors
      console.error("Verification network error:", err);
      setError("An error occurred while verifying. Please try again later.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSkip = async () => {
    //const updatedUser = { ...user, skippedOpenAlex: true };
    //setUser(updatedUser);
    if (onComplete) await onComplete(user);
    navigate("/projects");
  };

  const handleSwitchToManual = () => {
    setViewMode('manual');
    setError("");
  };

  const handleBackToSearch = () => {
    setViewMode('search');
    setError("");
  };

  const formatInstitution = (institutions) => {
    if (!institutions || institutions.length === 0) return null;
    return institutions[0].display_name;
  };

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // =========================================
  // RENDERS
  // =========================================

  const renderSearchView = () => (
    <>
      <div className="openalex-search-wrapper">
        <div className="openalex-search-field">
          <Search size={18} className="openalex-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name (e.g., John Smith)"
            className="openalex-search-input"
            autoFocus
          />
          {isSearching && <Loader2 size={18} className="openalex-search-spinner" />}
        </div>
        <p className="openalex-search-hint">Search OpenAlex database of over 200 million scholarly works</p>
      </div>

      <div className="openalex-results">
        {hasSearched && !isSearching && searchResults.length === 0 && (
          <div className="openalex-no-results">
            <p>No profiles found for "{debouncedSearch}"</p>
            <p className="openalex-no-results-hint">Try searching with your full name or a variation</p>
          </div>
        )}

        {searchResults.map((profile) => (
          <div key={profile.id} className={`openalex-profile-card ${selectedProfile?.id === profile.id ? 'selected' : ''}`}>
            <div className="openalex-profile-main" onClick={() => handleSelectProfile(profile)}>
              <div className="openalex-profile-select">
                <div className={`openalex-checkbox ${selectedProfile?.id === profile.id ? 'checked' : ''}`}>
                  {selectedProfile?.id === profile.id && <Check size={14} />}
                </div>
              </div>

              <div className="openalex-profile-info">
                <div className="openalex-profile-header-row">
                  <h3 className="openalex-profile-name">{profile.display_name}</h3>
                  <div className="openalex-profile-stats">
                    <span className="openalex-stat"><FileText size={12} /> {formatNumber(profile.works_count)} works</span>
                    <span className="openalex-stat">{formatNumber(profile.cited_by_count)} citations</span>
                  </div>
                </div>
                {formatInstitution(profile.last_known_institutions) && (
                  <div className="openalex-profile-detail">
                    <Building2 size={14} /> <span>{formatInstitution(profile.last_known_institutions)}</span>
                  </div>
                )}
                {profile.display_name_alternatives?.length > 0 && (
                  <div className="openalex-profile-aliases">
                    Also known as: {profile.display_name_alternatives.slice(0, 2).join(", ")}
                  </div>
                )}
              </div>

              <button className="openalex-expand-btn" onClick={(e) => { e.stopPropagation(); handleProfileExpand(profile); }}>
                {expandedProfile === profile.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {expandedProfile === profile.id && (
              <div className="openalex-profile-expanded">
                <div className="openalex-works-header">
                  <h4>Top Publications</h4>
                  <a href={profile.id} target="_blank" rel="noopener noreferrer" className="openalex-external-link">
                    View full profile <ExternalLink size={12} />
                  </a>
                </div>
                {profile.works ? (
                  profile.works.length > 0 ? (
                    <ul className="openalex-works-list">
                      {profile.works.map((work) => (
                        <li key={work.id} className="openalex-work-item">
                          <a href={work.doi || work.id} target="_blank" rel="noopener noreferrer" className="openalex-work-title">
                            {work.title || "Untitled"}
                          </a>
                          <div className="openalex-work-meta">
                            <span>{work.publication_year}</span>
                            {work.cited_by_count > 0 && <span>{work.cited_by_count} citations</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="openalex-no-works">No publications found</p>
                ) : (
                  <div className="openalex-loading-works">
                    <Loader2 size={16} className="openalex-search-spinner" /> <span>Loading publications...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="openalex-actions">
        <button className="openalex-confirm-btn" onClick={handleConfirmOpenAlexSelection} disabled={!selectedProfile || isSubmitting}>
          {isSubmitting ? <span className="openalex-btn-spinner"></span> : <><Check size={18} /> Confirm selection</>}
        </button>
        <button className="openalex-manual-btn" onClick={handleSwitchToManual} disabled={isSubmitting}>
          <User size={16} /> Can't find your profile? Enter details manually
        </button>
        {allowSkip && <button className="openalex-skip-btn" onClick={handleSkip} disabled={isSubmitting}>Skip for now</button>}
      </div>
    </>
  );

  const renderManualView = () => (
    <>
      <button className="openalex-back-btn" onClick={handleBackToSearch}>
        <ArrowLeft size={16} /> Back to OpenAlex search
      </button>
      <div className="openalex-manual-form">
        
        <div className="openalex-field">
          <label htmlFor="manual-name"><User size={14} /> Full Name <span className="required">*</span></label>
          <input type="text" id="manual-name" value={manualForm.name} onChange={(e) => handleManualFormChange('name', e.target.value)} placeholder="John Doe" required />
        </div>

        <div className="openalex-field">
          <label htmlFor="manual-degree"><GraduationCap size={14} /> Degree / Position <span className="required">*</span></label>
          <select id="manual-degree" value={manualForm.degree} onChange={(e) => handleManualFormChange('degree', e.target.value)} required>
            <option value="">Select your degree or position</option>
            {DEGREES.map(degree => <option key={degree} value={degree}>{degree}</option>)}
          </select>
        </div>

        <div className="openalex-field">
          <label htmlFor="manual-country"><Globe size={14} /> Country <span className="required">*</span></label>
          <select id="manual-country" value={manualForm.country} onChange={(e) => handleManualFormChange('country', e.target.value)} required>
            <option value="">Select your country</option>
            {COUNTRIES.map(country => <option key={country} value={country}>{country}</option>)}
          </select>
        </div>

        {/* Updated Institution Autocomplete */}
        <div className="openalex-field">
          <label htmlFor="manual-institution">
            <Building2 size={14} /> Institution <span className="required">*</span>
          </label>
          <div className="relative">
            <input 
              type="text" 
              id="manual-institution" 
              value={manualForm.institution} 
              onChange={(e) => {
                handleManualFormChange('institution', e.target.value);
                setInstSearchQuery(e.target.value);
                setShowInstSuggestions(true);
              }} 
              onFocus={() => setShowInstSuggestions(true)}
              onBlur={() => setTimeout(() => setShowInstSuggestions(false), 200)}
              placeholder="e.g., Stanford University" 
              autoComplete="off"
              required 
            />
            {isSearchingInst && (
              <Loader2 size={16} className="absolute right-3 top-3.5 animate-spin text-stone-400" />
            )}
            
            {showInstSuggestions && instSearchResults.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-sm border border-stone-200 bg-white shadow-lg text-sm list-none p-0 m-0">
                {instSearchResults.map(inst => (
                  <li
                    key={inst.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleManualFormChange('institution', inst.display_name);
                      setShowInstSuggestions(false);
                    }}
                    className="cursor-pointer border-b border-stone-100 px-3 py-2 text-stone-700 hover:bg-stone-100 last:border-0 m-0"
                  >
                    {inst.display_name}
                    {inst.country_code && <span className="ml-2 text-xs text-stone-400">({inst.country_code})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="openalex-field-hint">Type your institution manually or select from the database</p>
        </div>

        {/* Updated Interests using CreatableTagInput */}
        <div className="openalex-field">
          <CreatableTagInput
            label={<><Lightbulb size={14} className="mr-1"/> Research Interests (Topics) <span className="text-red-600 ml-1">*</span></>}
            placeholder="Select or create topics"
            selectedItems={manualForm.interests}
            suggestions={topicsCatalog.map((item) => item.topic_name)}
            accentClass="border-yellow-300 bg-yellow-50 text-stone-800"
            inputValue={topicInput}
            onInputChange={setTopicInput}
            onAddItem={addUniqueFormValue('interests')}
            onRemoveItem={removeFormValue('interests')}
            disabled={isSubmitting}
          />
        </div>

        {/* Updated Skills using CreatableTagInput */}
        <div className="openalex-field">
          <CreatableTagInput
            label={<><Sparkles size={14} className="mr-1"/> Skills & Keywords <span className="text-red-600 ml-1">*</span></>}
            placeholder="Select or create skills"
            selectedItems={manualForm.skills}
            suggestions={skillsCatalog.map((item) => item.skill_name)}
            accentClass="border-green-300 bg-green-50 text-stone-800"
            inputValue={skillInput}
            onInputChange={setSkillInput}
            onAddItem={addUniqueFormValue('skills')}
            onRemoveItem={removeFormValue('skills')}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="openalex-actions">
        <button className="openalex-confirm-btn" onClick={handleSubmitManualForm} disabled={isSubmitting}>
          {isSubmitting ? <span className="openalex-btn-spinner"></span> : <><Check size={18} /> Save profile</>}
        </button>
        {allowSkip && <button className="openalex-skip-btn" onClick={handleSkip} disabled={isSubmitting}>Skip for now</button>}
      </div>
    </>
  );

  const renderVerifyPrompt = () => (
    <div className="openalex-verify-card">
      <div className="openalex-verify-icon-wrapper">
        <ShieldCheck size={48} className="openalex-verify-icon-large" />
      </div>
      <h3>Verify your Institution</h3>
      <p>Would you like to verify your institution?</p>
      
      <div className="openalex-actions" style={{ marginTop: '2rem' }}>
        <button className="openalex-confirm-btn" onClick={() => setViewMode('verify-form')}>
          Yes, check if my institution can be verified
        </button>
        <button className="openalex-skip-btn" onClick={() => navigate("/projects")}>
          I'll do this later
        </button>
      </div>
    </div>
  );

  const renderVerifyForm = () => {
    // 1. Loading State
    if (isLoadingDomain) {
      return (
        <div className="openalex-verify-card">
          <h3 className="openalex-verify-title">Checking Institution</h3>
          <div className="openalex-loading-domain">
            <Loader2 size={24} className="openalex-search-spinner" />
            <p>Retrieving institution requirements...</p>
          </div>
        </div>
      );
    }

    // 2. Empty/Unknown Institution State
    if (verificationDomains.length === 0) {
      return (
        <div className="openalex-verify-card">
          <div className="openalex-verify-icon-wrapper" style={{ color: '#dc2626' }}>
            <Building2 size={48} className="openalex-verify-icon-large" />
          </div>
          <h3 className="openalex-verify-title">Institution Unknown</h3>
          <p className="openalex-verify-subtitle">
            We are sorry, your institution is unknown to us.
          </p>
          
          <div className="openalex-actions" style={{ marginTop: '2rem' }}>
            <button 
              className="openalex-confirm-btn" 
              onClick={() => navigate("/projects")}
            >
              Continue without verification <ArrowRight size={18} />
            </button>
            <button 
              className="openalex-manual-btn" 
              onClick={() => setViewMode('manual')}
            >
              <User size={16} /> Try manual profile setup instead
            </button>
          </div>
        </div>
      );
    }

    // 3. Normal State (Domains Found)
    return (
      <div className="openalex-verify-card">
        <h3 className="openalex-verify-title">Enter your Academic Email</h3>
        <p className="openalex-verify-subtitle">We will send a magic verification code to your institutional email address.</p>
        
        <div className="openalex-field">
          <label htmlFor="verify-prefix">
            <Mail size={14} /> Username
          </label>
          <div className="openalex-email-input-group">
            <input
              type="text"
              id="verify-prefix"
              value={emailPrefix}
              onChange={(e) => {
                setError("");
                setEmailPrefix(e.target.value);
              }}
              placeholder="e.g. j.doe@faculty."
              autoFocus
            />
            {verificationDomains.length > 1 ? (
              <select 
                className="openalex-email-domain-select"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
              >
                {verificationDomains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            ) : (
              <div className="openalex-email-domain">
                {selectedDomain}
              </div>
            )}
          </div>
        </div>

        <div className="openalex-actions" style={{ marginTop: '2rem' }}>
          <button 
            className="openalex-confirm-btn" 
            onClick={handleRequestMagicCode}
            disabled={isVerifying || !selectedDomain}
          >
            {isVerifying ? <span className="openalex-btn-spinner"></span> : <><Mail size={18} /> Send Magic Code</>}
          </button>
          <button className="openalex-skip-btn" onClick={() => navigate("/projects")} disabled={isVerifying}>
            Skip for now
          </button>
        </div>
      </div>
    );
  };

  const renderVerifyCode = () => (
    <div className="openalex-verify-card">
      <h3 className="openalex-verify-title">Check your inbox</h3>
      <p className="openalex-verify-subtitle">
        We sent a verification code to <strong>{emailPrefix}{selectedDomain}</strong>
      </p>

      <div className="openalex-field">
        <label htmlFor="verify-code">
          <ShieldCheck size={14} /> Magic Code
        </label>
        <input
          type="text"
          id="verify-code"
          value={magicCode}
          onChange={(e) => {
            setError("");
            setMagicCode(e.target.value);
          }}
          placeholder="Enter the 6-digit code"
          maxLength={6}
          style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.25rem', padding: '1rem' }}
          autoFocus
        />
      </div>

      <div className="openalex-actions" style={{ marginTop: '2rem' }}>
        <button 
          className="openalex-confirm-btn" 
          onClick={handleVerifyMagicCode}
          disabled={isVerifying || magicCode.length < 4}
        >
          {isVerifying ? <span className="openalex-btn-spinner"></span> : <><Check size={18} /> Verify Code</>}
        </button>
        <button className="openalex-skip-btn" onClick={() => setViewMode('verify-form')} disabled={isVerifying}>
          Use a different email
        </button>
      </div>
    </div>
  );

  const renderVerifySuccess = () => (
    <div className="openalex-verify-card success">
      <div className="openalex-verify-icon-wrapper success">
        <CheckCircle size={64} color="#059669" />
      </div>
      <h3 style={{ color: '#059669' }}>Institution Verified!</h3>
      <p>Your academic email has been successfully linked to your profile.</p>

      <div className="openalex-actions" style={{ marginTop: '2rem' }}>
        <button className="openalex-confirm-btn" onClick={() => navigate("/projects")} style={{ background: '#059669' }}>
          Continue to Projects <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  // Determine Title based on View
  const getHeaderInfo = () => {
    switch(viewMode) {
      case 'search': return { title: 'Link your research profile', sub: 'Search for your OpenAlex profile to import your publications.' };
      case 'manual': return { title: 'Complete your profile', sub: 'Tell us about yourself so we can help you find collaborators.' };
      default: return { title: 'Verify Status', sub: 'Secure your academic identity.' };
    }
  };
  const { title, sub } = getHeaderInfo();

  return (
    <div className="openalex-page">
      <div className="openalex-container">
        
        {/* Only show standard header for profile setup, not verification flows (which have their own headers) */}
        {(viewMode === 'search' || viewMode === 'manual') && (
          <div className="openalex-header">
            <div className="openalex-logo-wrapper">
              <img src="/icon1.svg" alt="Logo" className="openalex-logo" />
            </div>
            <h1 className="openalex-title">{title}</h1>
            <p className="openalex-subtitle">{sub}</p>
          </div>
        )}

        {error && (
          <div className="openalex-message openalex-error">
            <X size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* View Router */}
        {viewMode === 'search' && renderSearchView()}
        {viewMode === 'manual' && renderManualView()}
        {viewMode === 'verify-prompt' && renderVerifyPrompt()}
        {viewMode === 'verify-form' && renderVerifyForm()}
        {viewMode === 'verify-code' && renderVerifyCode()}
        {viewMode === 'verify-success' && renderVerifySuccess()}

        {(viewMode === 'search' || viewMode === 'manual') && (
          <p className="openalex-footer-note">
            {viewMode === 'search' ? "You can update your profile anytime from your account settings." : "All fields marked with * are required."}
          </p>
        )}
      </div>

      <style>{openAlexStyles}</style>
    </div>
  );
}

const openAlexStyles = `
  .openalex-page {
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1.5rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .openalex-container {
    width: 100%;
    max-width: 600px;
    background: #ffffff;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 8px;
    padding: 2.5rem;
    margin-top: 2rem;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  }

  .openalex-header { text-align: center; margin-bottom: 2rem; }
  .openalex-logo-wrapper { width: 60px; height: 60px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; }
  .openalex-logo { width: 60px; height: 60px; }
  .openalex-title { font-size: 1.75rem; font-weight: 700; color: var(--text-secondary, #505e76); margin: 0 0 0.5rem 0; font-family: 'Playfair Display', serif; }
  .openalex-subtitle { font-size: 0.9rem; color: var(--text-secondary, #505e76); margin: 0; line-height: 1.6; }
  
  .openalex-message { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem 1rem; border-radius: 4px; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
  .openalex-message svg { flex-shrink: 0; margin-top: 2px; }
  .openalex-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }

  /* Verification Specific Styles */
  .openalex-verify-card {
    text-align: center;
    padding: 1rem 0;
  }
  
  .openalex-verify-card.success {
    padding: 2rem 0;
  }

  .openalex-verify-icon-wrapper {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
    color: var(--accent, #003d82);
  }

  .openalex-verify-icon-wrapper.success {
    animation: scale-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }

  .openalex-verify-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #2c2c2c);
    margin: 0 0 0.5rem 0;
  }

  .openalex-verify-card p {
    color: var(--text-secondary, #505e76);
    line-height: 1.6;
    margin: 0 0 1.5rem 0;
    font-size: 0.95rem;
  }

  .openalex-email-input-group {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 4px;
    overflow: hidden;
    background: #ffffff;
    transition: all 0.2s ease;
  }

  .openalex-email-input-group:focus-within {
    border-color: var(--accent, #003d82);
    box-shadow: 0 0 0 2px rgba(0, 61, 130, 0.1);
  }

  .openalex-email-input-group input {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    flex: 1;
    min-width: 0; /* Prevents flex flex overflow */
  }

  .openalex-email-domain {
    background: #f8f9fa;
    padding: 0.875rem 1rem;
    color: var(--text-secondary, #505e76);
    border-left: 1px solid var(--border, #e5e5e5);
    font-weight: 500;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .openalex-loading-domain {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0;
    color: var(--text-secondary, #505e76);
  }

  @keyframes scale-up {
    0% { transform: scale(0.5); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* (All original form, list, and profile card styles retained here) */
  .openalex-search-wrapper { margin-bottom: 1.5rem; }
  .openalex-search-field { position: relative; display: flex; align-items: center; }
  .openalex-search-icon { position: absolute; left: 1rem; color: var(--text-secondary, #505e76); pointer-events: none; }
  .openalex-search-icon.small { left: 0.75rem; }
  .openalex-search-input { width: 100%; padding: 0.875rem 1rem 0.875rem 2.75rem; background: #ffffff; border: 1px solid var(--border, #e5e5e5); border-radius: 4px; font-size: 0.95rem; color: var(--text-primary, #2c2c2c); transition: all 0.2s ease; font-family: inherit; box-sizing: border-box; }
  .openalex-search-input:focus { outline: none; border-color: var(--accent, #003d82); box-shadow: 0 0 0 2px rgba(0, 61, 130, 0.1); }
  .openalex-search-spinner { position: absolute; right: 1rem; color: var(--accent, #003d82); animation: spin 1s linear infinite; }
  .openalex-search-hint { font-size: 0.75rem; color: var(--text-secondary, #505e76); margin: 0.5rem 0 0 0; }
  .openalex-results { max-height: 400px; overflow-y: auto; margin-bottom: 1.5rem; }
  .openalex-no-results { text-align: center; padding: 2rem; color: var(--text-secondary, #505e76); }
  .openalex-profile-card { border: 1px solid var(--border, #e5e5e5); border-radius: 6px; margin-bottom: 0.75rem; transition: all 0.2s ease; overflow: hidden; }
  .openalex-profile-card.selected { border-color: var(--accent, #003d82); background: rgba(0, 61, 130, 0.02); }
  .openalex-profile-main { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; cursor: pointer; }
  .openalex-profile-select { flex-shrink: 0; padding-top: 2px; }
  .openalex-checkbox { width: 20px; height: 20px; border: 2px solid var(--border, #e5e5e5); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: white; }
  .openalex-checkbox.checked { background: var(--accent, #003d82); border-color: var(--accent, #003d82); color: white; }
  .openalex-profile-info { flex: 1; min-width: 0; }
  .openalex-profile-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; text-align: left; }
  .openalex-profile-name { font-size: 1rem; font-weight: 600; color: var(--text-primary, #2c2c2c); margin: 0; }
  .openalex-profile-stats { display: flex; gap: 0.75rem; flex-shrink: 0; }
  .openalex-stat { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary, #505e76); }
  .openalex-profile-detail { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary, #505e76); margin-bottom: 0.25rem; text-align: left; }
  .openalex-expand-btn { flex-shrink: 0; background: none; border: none; padding: 0.25rem; cursor: pointer; color: var(--text-secondary, #505e76); }
  .openalex-profile-expanded { padding: 0 1rem 1rem 3rem; border-top: 1px solid var(--border, #e5e5e5); background: #fafafa; text-align: left;}
  .openalex-works-header { display: flex; justify-content: space-between; padding: 0.75rem 0 0.5rem; }
  .openalex-works-header h4 { font-size: 0.8rem; margin: 0; text-transform: uppercase; }
  .openalex-external-link { font-size: 0.75rem; color: var(--accent, #003d82); text-decoration: none; }
  .openalex-works-list { list-style: none; padding: 0; margin: 0; }
  .openalex-work-item { padding: 0.5rem 0; border-bottom: 1px solid var(--border, #e5e5e5); }
  .openalex-work-title { font-size: 0.85rem; color: var(--text-primary, #2c2c2c); text-decoration: none; display: block; }
  .openalex-work-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: var(--text-secondary, #505e76); margin-top: 0.25rem; }
  
  .openalex-actions { display: flex; flex-direction: column; gap: 0.75rem; }
  .openalex-confirm-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem 1.5rem; background: var(--text-primary, #2c2c2c); border: none; border-radius: 4px; font-size: 1rem; color: white; cursor: pointer; transition: all 0.2s ease; min-height: 48px; font-family: inherit; }
  .openalex-confirm-btn:hover:not(:disabled) { background: var(--accent, #003d82); }
  .openalex-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .openalex-btn-spinner { width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
  .openalex-manual-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: none; border: 1px solid var(--border, #e5e5e5); padding: 0.75rem 1.5rem; font-size: 0.9rem; color: var(--accent, #003d82); cursor: pointer; border-radius: 4px; font-family: inherit;}
  .openalex-skip-btn { width: 100%; background: none; border: none; padding: 0.75rem 1.5rem; font-size: 0.85rem; color: var(--text-secondary, #505e76); cursor: pointer; font-family: inherit; }
  .openalex-skip-btn:hover:not(:disabled) { color: var(--text-primary, #2c2c2c); text-decoration: underline; }

  /* Manual Form */
  .openalex-back-btn { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0; font-size: 0.85rem; color: var(--accent, #003d82); cursor: pointer; margin-bottom: 1.5rem; font-family: inherit;}
  .openalex-manual-form { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 1.5rem; text-align: left; }
  .openalex-field { display: flex; flex-direction: column; gap: 0.5rem; text-align: left;}
  .openalex-field label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 500; color: var(--text-primary, #2c2c2c); }
  .openalex-field .required { color: #dc2626; }
  .openalex-field input, .openalex-field select, .openalex-field textarea { width: 100%; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid var(--border, #e5e5e5); border-radius: 4px; font-size: 0.95rem; font-family: inherit; box-sizing: border-box;}
  .openalex-field textarea { resize: vertical; min-height: 80px; }
  .openalex-field input:focus, .openalex-field select:focus, .openalex-field textarea:focus { outline: none; border-color: var(--accent, #003d82); box-shadow: 0 0 0 2px rgba(0, 61, 130, 0.1); }
  
  .openalex-skills-selected { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
  .openalex-skill-tag { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem 0.35rem 0.75rem; background: rgba(0, 61, 130, 0.08); border: 1px solid rgba(0, 61, 130, 0.2); border-radius: 100px; font-size: 0.8rem; color: var(--accent, #003d82); }
  .openalex-skill-remove { background: none; border: none; padding: 0; cursor: pointer; color: var(--accent, #003d82); opacity: 0.6; }
  
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 480px) {
    .openalex-container { padding: 1.5rem; }
    .openalex-profile-header-row { flex-direction: column; gap: 0.5rem; }
  }

.openalex-email-domain-select {
    width: auto !important; /* Overrides the 100% from .openalex-field select */
    flex: 0 0 auto; /* Prevents flexbox from stretching it */
    max-width: 55%; /* Ensures a super long domain doesn't crush the input */
    
    background: #f8f9fa;
    color: var(--text-secondary, #505e76);
    border: none;
    border-left: 1px solid var(--border, #e5e5e5);
    font-weight: 500;
    font-family: inherit;
    font-size: 0.95rem;
    cursor: pointer;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23505e76' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding: 0 2rem 0 1rem;
    text-overflow: ellipsis;
  }
  
  .openalex-email-domain-select:focus {
    background-color: #f1f3f5;
  }

  /* --- FIX FOR BUG 1: The Spinner Displacement --- */
  .openalex-loading-domain .openalex-search-spinner {
    position: static; /* Removes absolute positioning so it stays centered */
    margin: 0;
  }
`;