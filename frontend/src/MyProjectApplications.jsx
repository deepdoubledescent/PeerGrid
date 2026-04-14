import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import './App.css'
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { searchMyProjectApplications, getTopics, getProjectTypes, getSkills, getLocations, getInstitutes } from './Controller';
import { ChevronDown, Minus, Search, X, Calendar, User, Tag, Landmark, Globe, Calendar as CalendarIcon, Hammer, Briefcase } from 'lucide-react';
import { MinimalCalendar, highlightMarkdownExcerpt, highlightText } from './utils';

const getApplicationStatusLabel = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'accepted':
            return 'Accepted';
        case 'rejected':
            return 'Rejected';
        case 'pending':
        default:
            return 'Pending';
    }
};

const getApplicationStatusClass = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'accepted':
            return 'bg-green-100 text-green-700 border border-green-200';
        case 'rejected':
            return 'bg-red-100 text-red-700 border border-red-200';
        case 'pending':
        default:
            return 'bg-amber-100 text-amber-700 border border-amber-200';
    }
};

const ListEntry = ({ project, isOpen, onToggle, isKeywordInQuery, isKeywordSelected, onKeywordToggle, highlightWord = "" }) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    };

    return (
        <div className="py-4">
            <div
                className="project-header flex items-center justify-between min-w-full py-4 -my-4 cursor-pointer relative z-10 gap-4"
                onClick={onToggle}
                aria-expanded={isOpen}
                role="button"
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                <div className="flex items-center min-w-0 flex-1">
                    <Link to={`/projects/${project.id}`} className="min-w-0">
                        <h1 className="project-title text-xl text-left hover:!text-[#6E7A8D]">
                            {highlightWord && project.relevant_field === "title"
                                ? highlightText(project.title, highlightWord)
                                : project.title}
                        </h1>
                    </Link>

                    <div className="project-tags-small pl-2 z-11 pointer-events-none">
                        {(project.types || []).map((type) => (
                            <span key={`type-${type}`} className="tag-ghost pointer-events-none">
                                {type}
                            </span>
                        ))}

                        {(project.topics || []).map((k) => {
                            return (
                                <button
                                    key={k}
                                    className={`tag-ghost pointer-events-auto cursor-pointer ${isKeywordInQuery(k) ? 'bg-yellow-100' : ''}
                                        ${isKeywordSelected(k) ? '!border-1 !border-[var(--yellow)] hover:!tag-ghost' : 'hover:border-1 hover:border-[var(--yellow)]'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onKeywordToggle(k);
                                    }}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    {k}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="shrink-0">
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getApplicationStatusClass(project.application_status)}`}
                    >
                        {getApplicationStatusLabel(project.application_status)}
                    </span>
                </div>
            </div>

            <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="z-9 overflow-hidden pt-3 text-left mx-7">
                    <div className='flex w-full gap-4 flex-wrap'>
                        <div className='font-[500] text-[var(--text-secondary)]'>
                            <div className="icon-small"><User size={14} /></div>
                            <Link to={`/profile/${project.author}`} className="cursor-pointer">
                                {project.author_display_name}
                            </Link>
                        </div>

                        <div className='text-zinc-400 cursor-default'>
                            <div className="icon-small"><Calendar size={14} /></div>
                            <span>{project.published}</span>
                        </div>

                        {project.application_created_at && (
                            <div className='text-zinc-400 cursor-default'>
                                <div className="icon-small"><Calendar size={14} /></div>
                                <span>
                                    Applied: {new Date(project.application_created_at).toISOString().split('T')[0]}
                                </span>
                            </div>
                        )}
                    </div>

                    <p className="project-short-description">
                        {highlightWord && project.relevant_field === "short_description"
                            ? highlightText(project.short_description, highlightWord)
                            : project.short_description}
                    </p>

                    {highlightWord && project.relevant_field === "long_description" ? (
                        <div className="opacity-80 text-gray-500 text-sm bg-gray-100 border-2 border-gray-200 rounded-md p-4 mt-4">
                            <ReactMarkdown
                                children={highlightMarkdownExcerpt(project.long_description, highlightWord)["text"]}
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    a: ({ href, children, ...props }) => {
                                        if (href === '#highlight-match') {
                                            return (
                                                <span className="bg-yellow-100 rounded shadow-sm border border-yellow-100">
                                                    {children}
                                                </span>
                                            );
                                        }
                                        return <a href={href} {...props} className="text-blue-600 underline">{children}</a>;
                                    }
                                }}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const TagSelectModal = ({ tagState, tagList, onTagToggle, setModalState, color, title = "Select Keywords" }) => {
    const [filterText, setFilterText] = useState('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm"
                onClick={() => setModalState(false)}
            ></div>

            <div className="relative bg-stone-50 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-stone-200">
                <div className="flex items-center justify-between p-6 pb-2 border-b border-stone-100">
                    <h3 className="font-sans uppercase tracking-widest text-xs font-bold text-stone-500">
                        {title}
                    </h3>
                    <button
                        onClick={() => setModalState(false)}
                        className="text-stone-400 hover:text-stone-900 transition-colors"
                    >
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                <div className="w-full flex relative">
                    <input
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Filter"
                        className="h-fit w-full border-b-1 border-black bg-transparent mb-5 py-1 mx-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
                    />

                    <div className="absolute right-12 py-1 text-stone-400">
                        {filterText ? (
                            <button
                                onClick={() => setFilterText("")}
                                className="hover:text-stone-900 transition-colors opacity-50"
                            >
                                <X size={24} strokeWidth={1.5} />
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-wrap overflow-y-auto px-6 gap-y-2 custom-scrollbar">
                    {tagList
                        .filter((k) =>
                            k.toLowerCase().trim().includes(filterText.toLowerCase().trim())
                        )
                        .map((k) => {
                            const isSelected = tagState.has(k);

                            return (
                                <button
                                    key={k}
                                    className={`tag-ghost pointer-events-auto cursor-pointer
                                                ${isSelected ? '!border-1 !border-[' + color + '] hover:!tag-ghost' : 'hover:border-1 hover:border-[' + color + ']'}`}
                                    onClick={() => onTagToggle(k)}
                                >
                                    {k}
                                </button>
                            );
                        })}
                </div>

                <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end">
                    <button
                        onClick={() => setModalState(false)}
                        className="px-6 py-2 bg-stone-900 text-stone-50 font-sans text-xs uppercase tracking-widest hover:bg-stone-700 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

const MyProjectApplications = ({ user }) => {
    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();
    const [projects, setProjects] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState(false);
    const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
    const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);

    const [projectTypes, setProjectTypes] = useState([]);
    const [topics, setTopics] = useState([]);
    const [skills, setSkills] = useState([]);

    const [openIds, setOpenIds] = useState([]);

    const [selectedKeywords, setSelectedKeywords] = useState(new Set());
    const [selectedSkills, setSelectedSkills] = useState(new Set());
    const [selectedTypes, setSelectedTypes] = useState(new Set());

    const [sortBy, setSortBy] = useState('date_newest');
    const [query, setQuery] = useState('');
    const [institute, setInstitute] = useState('');
    const [location, setLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [activeDateInput, setActiveDateInput] = useState(null);

    const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
    const [instituteSuggestions, setInstituteSuggestions] = useState([]);

    const updateParams = (updates) => {
        const newParams = new URLSearchParams(searchParams);

        updates.forEach(([key, value]) => {
            if (key === "keyword" || key === "skill" || key === "type") {
                newParams.delete(key);
                value.forEach((k) => newParams.append(key, k));
            } else {
                if (value) {
                    newParams.set(key, value);
                } else {
                    newParams.delete(key);
                }
            }
        });

        setSearchParams(newParams);
    };

    const filter = {
        sortBy: searchParams.get('sortBy') || 'date_newest',
        page: parseInt(searchParams.get('page') || '1', 10),
        query: searchParams.get('query') || '',
        location: searchParams.get('location') || '',
        institute: searchParams.get('institute') || '',
        published_before: searchParams.get('published_before') || '',
        published_after: searchParams.get('published_after') || '',
        keywords: searchParams.getAll('keyword') || [],
        skills: searchParams.getAll('skill') || [],
        types: searchParams.getAll('type') || [],
        results_per_page: parseInt(searchParams.get('results_per_page') || '10', 10),
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await searchMyProjectApplications(filter);
                setProjects(response.projects || []);
                setTotalResults(response.total_results || 0);
            } catch (error) {
                console.error("Failed to fetch application search results", error);
                setProjects([]);
                setTotalResults(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        setQuery(filter.query);
        setSelectedTypes(new Set(filter.types));
        setSelectedKeywords(new Set(filter.keywords));
        setSelectedSkills(new Set(filter.skills));
        setInstitute(filter.institute);
        setLocation(filter.location);
        setStartDate(filter.published_after);
        setEndDate(filter.published_before);
        setSortBy(filter.sortBy);
    }, [searchParams, user]);

    useEffect(() => {
        const loadProjectTypes = async () => {
            try {
                const rows = await getProjectTypes();
                setProjectTypes(rows || []);
            } catch (error) {
                console.error("Failed to fetch project types", error);
                setProjectTypes([]);
            }
        };

        loadProjectTypes();
    }, []);

    useEffect(() => {
        const loadTopics = async () => {
            try {
                const rows = await getTopics();
                setTopics(rows || []);
            } catch (error) {
                console.error("Failed to fetch topics", error);
                setTopics([]);
            }
        };

        loadTopics();
    }, []);

    useEffect(() => {
        const loadSkills = async () => {
            try {
                const rows = await getSkills();
                setSkills(rows || []);
            } catch (error) {
                console.error("Failed to fetch skills", error);
                setSkills([]);
            }
        };

        loadSkills();
    }, []);

    useEffect(() => {
        if (isKeywordsModalOpen || isSkillsModalOpen || isTypesModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isKeywordsModalOpen, isSkillsModalOpen, isTypesModalOpen]);

    useEffect(() => {
        handleSearch();
    }, [sortBy]);

    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            if (!showLocationSuggestions) return;

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
    }, [location, showLocationSuggestions]);

        useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            if (!showInstituteSuggestions) return;

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
    }, [institute, showInstituteSuggestions]);

    const totalPages = Math.ceil(totalResults / filter.results_per_page);
    const page = filter.page;

    const toggleItem = (id) => {
        setOpenIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleKeyword = (k) => {
        setSelectedKeywords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(k)) newSet.delete(k);
            else newSet.add(k);
            return newSet;
        });
    };

    const toggleSkill = (k) => {
        setSelectedSkills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(k)) newSet.delete(k);
            else newSet.add(k);
            return newSet;
        });
    };

    const toggleType = (k) => {
        setSelectedTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(k)) newSet.delete(k);
            else newSet.add(k);
            return newSet;
        });
    };

    const toggleAdvanced = () => {
        setIsAdvancedOpen(!isAdvancedOpen);
    };

    const clearSearch = () => {
        setQuery('');
    };

    const resetFilters = () => {
        setInstitute("");
        setLocation("");
        setStartDate("");
        setEndDate("");
        setSelectedKeywords(new Set());
        setSelectedSkills(new Set());
        setSelectedTypes(new Set());

        updateParams(Object.entries({
            page: 1,
            query: "",
            institute: "",
            location: "",
            sortBy: sortBy,
            published_before: "",
            published_after: "",
            keyword: [],
            skill: [],
            type: []
        }));
        setShowInstituteSuggestions(false);
        setInstituteSuggestions([]);
    };

    const handleKeyDownInSearchBar = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSearch = () => {
        updateParams(Object.entries({
            page: 1,
            query: query,
            institute: institute,
            location: location,
            sortBy: sortBy,
            published_before: endDate,
            published_after: startDate,
            keyword: Array.from(selectedKeywords),
            skill: Array.from(selectedSkills),
            type: Array.from(selectedTypes)
        }));
    };

    const handleLocationSelect = (selectedLocation) => {
        setLocation(selectedLocation);
        setShowLocationSuggestions(false);
    };

    const handleInstituteSelect = (selectedInstitute) => {
        setInstitute(selectedInstitute);
        setShowInstituteSuggestions(false);
    };

    return (
        <div>
            <div className="project-container">
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-stone-900">My Applications</h1>
                    <p className="text-stone-500 mt-2">
                        Browse projects you have applied to.
                    </p>
                </div>

                <div className={`search-field flex-col ${!isAdvancedOpen && "overflow-hidden"}`}>
                    <div className="search-bar flex flex-row">
                        <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
                            <div className="w-full flex relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDownInSearchBar}
                                    placeholder="Search my applications"
                                    className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
                                />

                                <div className="absolute right-0 py-2 text-stone-400">
                                    {query ? (
                                        <button onClick={clearSearch} className="hover:text-stone-900 transition-colors opacity-50">
                                            <X size={24} strokeWidth={1.5} />
                                        </button>
                                    ) : null}
                                    <button onClick={handleSearch} className="hover:text-stone-900 transition-colors">
                                        <Search size={24} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center">
                                <div className="h-8 w-px bg-stone-300 mx-6 hidden sm:block"></div>

                                <div className="flex flex-shrink-0 items-center gap-3 pr-2 relative">
                                    <span className="whitespace-pre text-[10px] font-sans uppercase text-stone-400 hidden sm:block">
                                        Sort By
                                    </span>
                                    <div className="relative">
                                        <ChevronDown size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                                        <select
                                            value={sortBy}
                                            id="search_sortBy_field"
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="appearance-none bg-transparent font-sans text-xs uppercase font-bold text-stone-700 cursor-pointer focus:outline-none pl-4 py-2 text-right hover:text-stone-900 transition-colors"
                                        >
                                            <option value="date_newest">Newest</option>
                                            <option value="date_oldest">Oldest</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center mt-2 z-20 relative">
                            <button
                                onClick={toggleAdvanced}
                                className="flex flex-col items-center group focus:outline-none"
                                aria-expanded={isAdvancedOpen}
                            >
                                <div className={`p-2 rounded-full duration-500 ${isAdvancedOpen ? 'bg-stone-200' : 'hover:bg-stone-200/50'}`}>
                                    <Minus
                                        size={20}
                                        className={`text-stone-600 transition-all ${isAdvancedOpen ? 'rotate-180' : ''}`}
                                        strokeWidth={1.5}
                                    />
                                    <Minus
                                        size={20}
                                        className={`text-stone-600 transition-all -mt-[100%] ${isAdvancedOpen ? 'rotate-180' : 'rotate-90'}`}
                                        strokeWidth={1.5}
                                    />
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isAdvancedOpen ? 'opacity-100 mt-8' : 'max-h-0 opacity-0 mt-0'
                    }`}>
                        <div className="grid grid-cols-6 gap-x-12 gap-y-5 pb-2 px-2">
                            <div className="flex flex-col gap-2 row-1 col-1 col-span-2 relative">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <Landmark size={14} /> Institute
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={institute}
                                        className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
                                        placeholder="Institute"
                                        onChange={(e) => {
                                            setInstitute(e.target.value);
                                            setShowInstituteSuggestions(true);
                                        }}
                                        onFocus={() => setShowInstituteSuggestions(true)}
                                        onBlur={() => {
                                            setTimeout(() => setShowInstituteSuggestions(false), 150);
                                        }}
                                    />

                                    {showInstituteSuggestions && (
                                        <ul className="absolute w-full z-13 bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                                            {instituteSuggestions.length > 0 ? (
                                                instituteSuggestions.map((item) => (
                                                    <li
                                                        key={item.id ?? item.label}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => handleInstituteSelect(item.label)}
                                                        className="px-3 py-2 hover:bg-stone-200 cursor-pointer text-stone-700 text-lg transition-colors border-b border-stone-100 last:border-0"
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
                            </div>

                            <div className="flex flex-col gap-2 relative row-1 col-3 col-span-4">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <Globe size={14} /> Location
                                </label>
                                <div className='relative'>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => {
                                            setLocation(e.target.value);
                                            setShowLocationSuggestions(true);
                                        }}
                                        onFocus={() => setShowLocationSuggestions(true)}
                                        onBlur={() => {
                                            setTimeout(() => setShowLocationSuggestions(false), 150);
                                        }}
                                        className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
                                        placeholder="City, Country or Country"
                                    />

                                    {showLocationSuggestions && (
                                        <ul className="absolute w-full z-13 bg-stone-50 border border-stone-200 mt-1 max-h-48 overflow-y-auto shadow-lg shadow-stone-200/50 rounded-sm custom-scrollbar">
                                            {locationSuggestions.length > 0 ? (
                                                locationSuggestions.map((item) => (
                                                    <li
                                                        key={`${item.type}-${item.label}`}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => handleLocationSelect(item.label)}
                                                        className="px-3 py-2 hover:bg-stone-200 cursor-pointer text-stone-700 text-lg transition-colors border-b border-stone-100 last:border-0"
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
                            </div>

                            <div className="flex flex-col gap-2 relative row-3 col-1 col-span-2">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <CalendarIcon size={14} /> Publication Date
                                </label>
                                <div className="flex gap-4 items-center">
                                    <div className="relative w-full">
                                        <input
                                            type="text"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            onFocus={() => setActiveDateInput('start')}
                                            onBlur={() => setActiveDateInput(null)}
                                            className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300 text-center"
                                            placeholder="YYYY-MM-DD"
                                        />
                                        {activeDateInput === 'start' && (
                                            <MinimalCalendar
                                                onSelect={(date) => {
                                                    setStartDate(date);
                                                    setActiveDateInput(null);
                                                }}
                                                initialDate={startDate}
                                            />
                                        )}
                                    </div>

                                    <span className="text-stone-400 font-sans text-xs">—</span>

                                    <div className="relative w-full">
                                        <input
                                            type="text"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            onFocus={() => setActiveDateInput('end')}
                                            onBlur={() => setActiveDateInput(null)}
                                            className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300 text-center"
                                            placeholder="YYYY-MM-DD"
                                        />
                                        {activeDateInput === 'end' && (
                                            <MinimalCalendar
                                                onSelect={(date) => {
                                                    setEndDate(date);
                                                    setActiveDateInput(null);
                                                }}
                                                initialDate={endDate}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 row-2 col-1 col-span-2">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <Tag size={14} /> Topics
                                </label>
                                <div className='flex flex-wrap pr-2 gap-y-2'>
                                    {[...selectedKeywords].map((k) => (
                                        <div key={k} className='group relative'>
                                            <div className="tag-ghost !border-1 !border-[var(--yellow)] cursor-default">{k}</div>
                                            <button
                                                onClick={() => toggleKeyword(k)}
                                                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 scale-0 border-1 border-[var(--border)] items-center justify-center rounded-full bg-white hover:bg-stone-200 text-stone-500 shadow-md transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-red-600 group-hover:scale-100 active:scale-90"
                                            >
                                                <X size={14} strokeWidth={2} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="tag-ghost pointer-events-auto cursor-pointer"
                                        onClick={() => setIsKeywordsModalOpen(true)}
                                    >
                                        + Add topic
                                    </button>
                                </div>

                                {isKeywordsModalOpen && (
                                    <TagSelectModal
                                        tagState={selectedKeywords}
                                        tagList={topics.map((t) => t.topic_name)}
                                        onTagToggle={toggleKeyword}
                                        setModalState={setIsKeywordsModalOpen}
                                        color="var(--yellow)"
                                        title="Select Topics"
                                    />
                                )}
                            </div>

                            <div className="flex flex-col gap-2 row-2 col-3 col-span-2">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <Hammer size={14} /> Skills
                                </label>
                                <div className='flex flex-wrap pr-2 gap-y-2'>
                                    {[...selectedSkills].map((k) => (
                                        <div key={k} className='group relative'>
                                            <div className="tag-ghost !border-1 !border-[var(--green)] cursor-default">{k}</div>
                                            <button
                                                onClick={() => toggleSkill(k)}
                                                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 scale-0 border-1 border-[var(--border)] items-center justify-center rounded-full bg-white hover:bg-stone-200 text-stone-500 shadow-md transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-red-600 group-hover:scale-100 active:scale-90"
                                            >
                                                <X size={14} strokeWidth={2} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="tag-ghost pointer-events-auto cursor-pointer"
                                        onClick={() => setIsSkillsModalOpen(true)}
                                    >
                                        + Add skill
                                    </button>
                                </div>

                                {isSkillsModalOpen && (
                                    <TagSelectModal
                                        tagState={selectedSkills}
                                        tagList={skills.map((s) => s.skill_name)}
                                        onTagToggle={toggleSkill}
                                        setModalState={setIsSkillsModalOpen}
                                        color="var(--green)"
                                        title="Select Skills"
                                    />
                                )}
                            </div>

                            <div className="flex flex-col gap-2 row-2 col-5 col-span-2">
                                <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                                    <Briefcase size={14} /> Project Types
                                </label>
                                <div className='flex flex-wrap pr-2 gap-y-2'>
                                    {[...selectedTypes].map((t) => (
                                        <div key={t} className='group relative'>
                                            <div className="tag-ghost !border-1 !border-stone-500 cursor-default">
                                                {t}
                                            </div>
                                            <button
                                                onClick={() => toggleType(t)}
                                                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 scale-0 border-1 border-[var(--border)] items-center justify-center rounded-full bg-white hover:bg-stone-200 text-stone-500 shadow-md transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-red-600 group-hover:scale-100 active:scale-90"
                                            >
                                                <X size={14} strokeWidth={2} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="tag-ghost pointer-events-auto cursor-pointer"
                                        onClick={() => setIsTypesModalOpen(true)}
                                    >
                                        + Add project type
                                    </button>
                                </div>

                                {isTypesModalOpen && (
                                    <TagSelectModal
                                        tagState={selectedTypes}
                                        tagList={projectTypes.map((t) => t.type_name)}
                                        onTagToggle={toggleType}
                                        setModalState={setIsTypesModalOpen}
                                        color="var(--border)"
                                        title="Select Project Types"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pb-4 border-b border-stone-200">
                            <button
                                className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
                                onClick={resetFilters}
                            >
                                Reset Filters
                            </button>
                            <button className="btn-primary" onClick={handleSearch}>
                                Search
                            </button>
                        </div>
                    </div>
                </div>

                <div className="project-list divide-y divide-gray-200">
                    {isLoading ? (
                        <div className='width-full center my-40 text-center text-gray-500'>
                            Loading applications...
                        </div>
                    ) : projects.length !== 0 ? (
                        projects.map((project) => (
                            <ListEntry
                                key={project.id}
                                project={project}
                                isOpen={openIds.includes(project.id)}
                                onToggle={() => toggleItem(project.id)}
                                isKeywordInQuery={(k) => filter.keywords.includes(k)}
                                isKeywordSelected={(k) => selectedKeywords.has(k)}
                                onKeywordToggle={toggleKeyword}
                                highlightWord={filter.query}
                            />
                        ))
                    ) : (
                        <div className='width-full center my-40 text-center text-gray-500'>
                            You have not applied to any projects yet.<br />
                            <button
                                className='underline cursor-pointer'
                                onClick={() => navigate("/projects")}
                            >
                                Browse projects
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className='flex gap-7 justify-center mt-4 text-gray-500 text-s'>
                <button
                    disabled={page <= 1}
                    onClick={() => updateParams([['page', String(page - 1)]])}
                    className='cursor-pointer disabled:text-gray-300 disabled:cursor-default'
                >
                    <u>Previous</u>
                </button>

                {[...Array(totalPages || 0)].map((_, i) => (
                    <button
                        key={i}
                        disabled={page === i + 1}
                        onClick={() => updateParams([['page', String(i + 1)]])}
                        className={`cursor-pointer disabled:cursor-default ${page === i + 1 ? "font-bold text-gray-700" : "font-normal"}`}
                    >
                        {i + 1}
                    </button>
                ))}

                <button
                    disabled={page >= totalPages}
                    onClick={() => updateParams([['page', String(page + 1)]])}
                    className='cursor-pointer disabled:text-gray-300 disabled:cursor-default'
                >
                    <u>Next</u>
                </button>
            </div>

            <div className="flex justify-center gap-6 mt-8">
                <button
                    className="btn-primary"
                    onClick={() => navigate("/projects/recommended")}
                >
                    Recommended Projects
                </button>
                <button
                    className="btn-primary"
                    onClick={() => navigate(`/profile/${user?.id || user?.sub}/projects`)}
                >
                    My Projects
                </button>
                <button
                    className="btn-primary"
                    onClick={() => navigate("/projects")}
                >
                    Browse Projects
                </button>

                <button
                    className="btn-primary"
                    onClick={() => navigate("/projects/new")}
                >
                    + Register New Project
                </button>
            </div>

            {user && (
                <div>
                    <div style={{ height: '100px' }}></div>

                    <div style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderTop: '1px solid #e5e5e5',
                        backdropFilter: 'blur(5px)',
                        padding: '1.5rem 0',
                        display: 'flex',
                        justifyContent: 'center',
                        zIndex: 100,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }}>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyProjectApplications;