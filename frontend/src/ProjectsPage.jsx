import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import './App.css'
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import CSS for math styling
import { getProjectsPageData, getLocations, getInstitutes } from './Controller';
import { ChevronDown, Minus, Search, X, Calendar, User, Tag, Landmark, Globe, Calendar as CalendarIcon, Hammer, Briefcase  } from 'lucide-react';
import { MinimalCalendar, highlightMarkdownExcerpt, highlightText } from './utils';

const ListEntry = ({ project, isOpen, onToggle, isKeywordInQuery, isKeywordSelected, onKeywordToggle, highlightWord="" }) => {

    const handleKeyDown = (e) => {
        // Trigger on Enter or Space
        if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // Prevent page scroll on Space
        onToggle();
        }
    };

    return (
    <div className="py-4">
        <div className="project-header flex items-center min-w-full py-4 -my-4 cursor-pointer relative z-10" 
            onClick={onToggle} aria-expanded={isOpen} role="button" tabIndex={0} onKeyDown={handleKeyDown}>
            <Link to={`/projects/${project.id}`}> 
                <h1 className="project-title text-xl text-left hover:!text-[#6E7A8D]">{highlightWord && project.relevant_field == "title" ? highlightText(project.title, highlightWord): project.title}</h1>
            </Link>
            <div className="project-tags-small pl-2 z-11 pointer-events-none">
                {(project.types || []).map((type) => (
                    <span key={`type-${type}`} className="tag-ghost pointer-events-none">
                    {type}
                    </span>
                ))}

                {project.topics.map(k => {
                    return (
                    <button
                        key={k}
                        className={`tag-ghost pointer-events-auto cursor-pointer ${isKeywordInQuery(k) ? 'bg-yellow-100' : ''}
                                    ${isKeywordSelected(k) ? '!border-1 !border-[var(--yellow)] hover:!tag-ghost' : 'hover:border-1 hover:border-[var(--yellow)]'}`}
                        onClick={(e) => {e.stopPropagation(); onKeywordToggle(k)}}
                        onKeyDown={(e) => {e.stopPropagation();}}
                    >
                        {k}
                    </button>
                    )
                })}
            </div>
        </div>
    <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="z-9 overflow-hidden pt-3 text-left mx-7">
            <div className='flex w-full gap-4'>
                <div className='font-[500] text-[var(--text-secondary)]'>
                    <div className="icon-small"><User size={14}/></div>
                    <Link to={`/profile/${project.author}`} className="cursor-pointer">{project.author_display_name}</Link>
                </div>
                <div className='text-zinc-400 cursor-default'>
                    <div className="icon-small"><Calendar size={14}/></div>
                    <span className="">{project.published}</span>
                </div>
            </div>
            <p className="project-short-description">{highlightWord && project.relevant_field == "short_description" ? highlightText(project.short_description, highlightWord): project.short_description}</p>

            {highlightWord && project.relevant_field == "long_description" ? (
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
                        }}
                    }
                />
                </div>
            ) : <></>}
        </div>
    </div>
    </div>
  )
}

const TagSelectModal = ({ tagState, tagList, onTagToggle, setModalState, color }) => {
    const [filterText, setFilterText] = useState('');

    console.log(color);
    
    return (                
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
            className="absolute inset-0 bg-stone-900/10 backdrop-blur-sm"
            onClick={() => setModalState(false)}
            ></div>
            
            {/* Modal Content */}
            <div className="relative bg-stone-50 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-stone-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-2 border-b border-stone-100">
                <h3 className="font-sans uppercase tracking-widest text-xs font-bold text-stone-500">
                Select Keywords
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
                
                {/* Right-aligned icon (Close if typing, Search otherwise) */}
                <div className="absolute right-12 py-1 text-stone-400">
                    {filterText ? (<button onClick={(e) => setFilterText("")} className="hover:text-stone-900 transition-colors opacity-50">
                            <X size={24} strokeWidth={1.5} />
                        </button>) : (<></>)}
                </div>
            </div>

            {/* Tag List */}
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

            {/* Modal Footer */}
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
    )
}

export default function ProjectsPage({ user }) {
  const navigate = useNavigate();

  const cards = [
    {
      title: "All Projects",
      description: "Search and filter research projects.",
      label: "Browse Projects",
      action: () => navigate("/projects/all"),
    },
    ...(user
      ? [
          {
            title: "My Applications",
            description: "Track the projects you have applied.",
            label: "View Applications",
            action: () => navigate("/projects/my-applications"),
          },
          {
            title: "New Project",
            description: "Register and publish a new project.",
            label: "+ Register New Project",
            action: () => navigate("/projects/new"),
          },
        ]
      : []),
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-semibold mb-8">Projects</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        {cards.map((card, index) => {
          const isOddLastCard = cards.length % 2 === 1 && index === cards.length - 1;

          return (
            <div
              key={card.title}
              className={`card p-6 h-full flex flex-col ${
                isOddLastCard
                  ? "md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:w-full md:mx-auto"
                  : ""
              }`}
            >
              <h2 className="text-xl font-medium mb-2">{card.title}</h2>
              <p className="text-sm opacity-70 mb-4 flex-1">{card.description}</p>
              <button className="btn-primary mt-auto" onClick={card.action}>
                {card.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ProjectsList = ({ user }) => {

    const navigate = useNavigate();

    //SEARCH

    const [searchParams, setSearchParams] = useSearchParams();
    const [projects, setProjects] = useState([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isKeywordsModalOpen, setIsKeywordsModalOpen] = useState(false);
    const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);

    const [projectTypes, setProjectTypes] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState(new Set());
    const [isTypesModalOpen, setIsTypesModalOpen] = useState(false);

    const [topics, setTopics] = useState([]);
    const [skills, setSkills] = useState([]);

    // this will update the page to show new search results
    const updateParams = (updates) => {
        const newParams = new URLSearchParams(searchParams);
        
        updates.map(([key,value]) => {
            if(key == "keyword" || key == "skill" || key == "type") {
                newParams.delete(key);
                value.map((k) => newParams.append(key, k))
            } else {
                if (value) {
                    newParams.set(key, value);
                } else {
                    newParams.delete(key);// Remove empty params to keep URL clean
                }
            }
        })
        
        setSearchParams(newParams);
    };

    // filter wraps the searchParams so they are readable for the searchProjects function
    const filter = {
        "sortBy": searchParams.get('sortBy') || (user ? 'recommended' : 'date_newest'),
        "page" : parseInt(searchParams.get('page') || '1', 10),
        "query" : searchParams.get('query') || '',
        "location": searchParams.get('location') || '',
        "institute" : searchParams.get('institute') || '',
        "published_before" : searchParams.get('published_before') || '',
        "published_after" : searchParams.get('published_after') || '',
        "keywords" : searchParams.getAll('keyword') || [],
        "skills" : searchParams.getAll('skill') || [],
        "types" : searchParams.getAll('type') || [],
        "results_per_page" : parseInt(searchParams.get('results_per_page') || '10', 10),
    }

    // listens whether updateParams was called and performs searchProjects call
    useEffect(() => {
        const fetchPageData = async () => {
            setIsLoading(true);
            try {
                const response = await getProjectsPageData(filter);

                setProjects(response.projects || []);
                setTotalResults(response.total_results || 0);
                setProjectTypes(response.projectTypes || []);
                setTopics(response.topics || []);
                setSkills(response.skills || []);
            } catch (error) {
                console.error("Failed to fetch projects page data", error);
                setProjects([]);
                setTotalResults(0);
                setProjectTypes([]);
                setTopics([]);
                setSkills([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPageData();

        setQuery(filter["query"]);
        setSelectedTypes(new Set(filter["types"]));
        setSelectedKeywords(new Set(filter["keywords"]));
        setSelectedSkills(new Set(filter["skills"]));
        setInstitute(filter["institute"]);
        setLocation(filter["location"]);
        setStartDate(filter["published_after"]);
        setEndDate(filter["published_before"]);
        setSortBy(filter["sortBy"]);
    }, [searchParams]);


    // wrappers around searchProjects results
    const totalPages = Math.ceil(totalResults / filter["results_per_page"]);
    const page = filter["page"] //for convenience

    // ITEMS
    const [openIds, setOpenIds] = useState([]);

    const [selectedKeywords, setSelectedKeywords] = useState(new Set());
    const [selectedSkills, setSelectedSkills] = useState(new Set());
    const [sortBy, setSortBy] = useState('recommended');
    const [query, setQuery] = useState('');
    const [institute, setInstitute] = useState('');
    const [location, setLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');


    const toggleItem = (id) => {
        setOpenIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(item => item !== id); // Remove ID if already open
            } else {
                return [...prev, id]; // Add ID if closed
            }
        });
    };

    const toggleKeyword = (k) => {
        setSelectedKeywords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(k)) {
                newSet.delete(k);
            } else {
                newSet.add(k);
            }
            return newSet;
        });
    };

    const toggleSkill = (k) => {
        setSelectedSkills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(k)) {
                newSet.delete(k);
            } else {
                newSet.add(k);
            }
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

    // SEARCH BAR

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);


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
        "page": 1,
        "query": "",
        "institute": "",
        "location": "",
        "sortBy": sortBy,
        "published_before": "",
        "published_after": "",
        "keyword": [],
        "skill": [],
        "type": []
    }));
    setShowInstituteSuggestions(false);
    setInstituteSuggestions([]);
    }

    const handleKeyDownInSearchBar = (e) => {
        if (e.key === 'Enter') {
        handleSearch();
        }
    };

    const handleSearch = () => {
        const validInstitute = instituteSuggestions.some(
            (item) => item.label === institute
        ) ? institute : '';

        updateParams(Object.entries({
            "page" : 1,
            "query" : query,
            "institute" : validInstitute,
            "location" : location,
            "sortBy" : sortBy,
            "published_before" : endDate,
            "published_after" : startDate,
            "keyword" : Array.from(selectedKeywords),
            "skill" : Array.from(selectedSkills),
            "type" : Array.from(selectedTypes)
        }));
    }

    useEffect(() => {
        handleSearch();
    }, [sortBy]);

      // Lock Body Scroll when Modal is Open
    useEffect(() => {
        if (isKeywordsModalOpen || isSkillsModalOpen || isTypesModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        // Cleanup function to ensure scroll is restored if component unmounts
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isKeywordsModalOpen, isSkillsModalOpen, isTypesModalOpen]);

    //Country Select Typeahead
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const handleLocationSelect = (value) => {
        setLocation(value);
        setShowLocationSuggestions(false);
    };

    const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
    const [instituteSuggestions, setInstituteSuggestions] = useState([]);

    const handleInstituteSelect = (value) => {
        setInstitute(value);
        setShowInstituteSuggestions(false);
    };

    // Date Picker States
    const [activeDateInput, setActiveDateInput] = useState(null); // 'start' | 'end' | null

    useEffect(() => {
        let cancelled = false;

        const loadLocations = async () => {
            const value = String(location || '').trim();

            if (!showLocationSuggestions) return;

            try {
                const rows = await getLocations(value);
                if (!cancelled) {
                    setLocationSuggestions(rows || []);
                }
            } catch (error) {
                console.error("Failed to fetch location suggestions", error);
                if (!cancelled) {
                    setLocationSuggestions([]);
                }
            }
        };

        loadLocations();

        return () => {
            cancelled = true;
        };
    }, [location, showLocationSuggestions]);

    useEffect(() => {
        let cancelled = false;

        const loadInstitutes = async () => {
            const value = String(institute || '').trim();

            if (!showInstituteSuggestions) return;

            try {
                const rows = await getInstitutes(value);
                if (!cancelled) {
                    setInstituteSuggestions(rows || []);
                }
            } catch (error) {
                console.error("Failed to fetch institute suggestions", error);
                if (!cancelled) {
                    setInstituteSuggestions([]);
                }
            }
        };

        loadInstitutes();

        return () => {
            cancelled = true;
        };
    }, [institute, showInstituteSuggestions]);
    
    return (
        <div>

        <div className="project-container">
            <div className="mb-8">
                <h1 className="text-3xl font-semibold text-stone-900">Search Projects</h1>
                <p className="text-stone-500 mt-2">
                    Browse and filter research projects.
                </p>
            </div>
            <div className={`search-field flex-col ${!isAdvancedOpen && "overflow-hidden"}`}>
                <div className="search-bar flex flex-row">
                    <div className="group w-full flex items-center border-b-1 border-black transition-all duration-300 focus-within:border-stone-600">
                        {/* actual bar */}
                        <div className="w-full flex relative">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => {setQuery(e.target.value)}}
                                onKeyDown={handleKeyDownInSearchBar}
                                placeholder="Search"
                                className="h-fit w-full bg-transparent py-2 pr-12 focus:outline-none placeholder-stone-400/50 text-stone-900 font-normal"
                            />
                            
                            {/* Right-aligned icon (Close if typing, Search otherwise) */}
                            <div className="absolute right-0 py-2 text-stone-400">
                                {query ? (<button onClick={clearSearch} className="hover:text-stone-900 transition-colors opacity-50">
                                        <X size={24} strokeWidth={1.5} />
                                    </button>) : (<></>)}
                                <button onClick={(e) => handleSearch()} className="hover:text-stone-900 transition-colors">
                                    <Search size={24} strokeWidth={1.5} className="" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center">
                            {/* Vertical Divider */}
                            <div className="h-8 w-px bg-stone-300 mx-6 hidden sm:block"></div>

                            {/* Sort Selection */}
                            <div className="flex flex-shrink-0 items-center gap-3 pr-2 relative">
                                <span className="whitespace-pre text-[10px] font-sans uppercase text-stone-400 hidden sm:block">
                                Sort By
                                </span>
                                <div className="relative">
                                <ChevronDown size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                                <select 
                                    value={sortBy}
                                    id="search_sortBy_field"
                                    onChange={(e) => {setSortBy(e.target.value)}}
                                    className="appearance-none bg-transparent font-sans text-xs uppercase font-bold text-stone-700 cursor-pointer focus:outline-none pl-4 py-2 text-right hover:text-stone-900 transition-colors"
                                >
                                    {user && <option value="recommended">Recommended</option>}
                                    <option value="date_newest">Newest</option>
                                    <option value="date_oldest">Oldest</option>
                                </select>
                                </div>
                        </div>
                        </div>
                    </div>

                    {/* Chevron / Toggle Area */}
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

                {/* Advanced Options Panel - Reveal Animation */}
                <div 
                className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isAdvancedOpen ? 'opacity-100 mt-8' : 'max-h-0 opacity-0 mt-0'
                }`}
                >
                {/* Grid Layout for Filters */}
                <div className="grid grid-cols-6 gap-x-12 gap-y-5 pb-2 px-2">
                    
                    {/* Field 1: Institute */}
                    <div className="flex flex-col gap-2 row-1 col-1 col-span-2 relative">
                        <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                            <Landmark size={14} /> Institute
                        </label>

                        <div className="relative">
                            <input
                                type="text"
                                value={institute}
                                onChange={(e) => {
                                    setInstitute(e.target.value);
                                    setShowInstituteSuggestions(true);
                                }}
                                onFocus={() => setShowInstituteSuggestions(true)}
                                onBlur={() => {
                                    setTimeout(() => setShowInstituteSuggestions(false), 150);
                                }}
                                className="w-full bg-transparent border-b border-stone-300 py-1 text-lg focus:outline-none focus:border-stone-800 transition-colors placeholder-stone-300"
                                placeholder="Institute"
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

                    {/* Field 2 and 3 combined (lazy to re-write): Location */}
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

                    {/* Field 4: Date Range */}
                    <div className="flex flex-col gap-2 relative row-3 col-1 col-span-2">
                    <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                        <CalendarIcon size={14} /> Publication Date
                    </label>
                    <div className="flex gap-4 items-center">
                        
                        {/* Start Date */}
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
                        
                        {/* End Date */}
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

                    {/* Field 4: Topics */}
                    <div className="flex flex-col gap-2 row-2 col-1 col-span-2">
                        <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                            <Tag size={14} /> Topics
                        </label>
                        <div className='flex flex-wrap pr-2 gap-y-2'>
                            {[...selectedKeywords].map((k) => {
                                return (
                                    <div key={k} className='group relative'>
                                        <div
                                            className="tag-ghost !border-1 !border-[var(--yellow)] cursor-default">{k}
                                        </div>
                                        <button
                                            onClick={() => toggleKeyword(k)}
                                            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 scale-0 border-1 border-[var(--border)] items-center justify-center rounded-full bg-white hover:bg-stone-200 text-stone-500 shadow-md transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-red-600 group-hover:scale-100 active:scale-90"
                                            >
                                            <X size={14} strokeWidth={2} />
                                        </button>
                                    </div>
                                )
                            })}
                            <button 
                                className={`tag-ghost pointer-events-auto cursor-pointer`} 
                                onClick={(e) => {setIsKeywordsModalOpen(true)}}>
                                    + Add topic
                            </button> 
                        </div>
                        {isKeywordsModalOpen && (<TagSelectModal tagState={selectedKeywords} tagList={topics.map((t) => t.topic_name)} onTagToggle={toggleKeyword} setModalState={setIsKeywordsModalOpen} color="var(--yellow)"></TagSelectModal>)}
                    </div>

                    {/* Field 5: Skills */}
                    <div className="flex flex-col gap-2 row-2 col-3 col-span-2">
                        <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                            <Hammer size={14} /> Skills
                        </label>
                        <div className='flex flex-wrap pr-2 gap-y-2'>
                            {[...selectedSkills].map((k) => {
                                return (
                                    <div key={k} className='group relative'>
                                        <div
                                            className="tag-ghost !border-1 !border-[var(--green)] cursor-default">{k}
                                        </div>
                                        <button
                                            onClick={() => toggleSkill(k)}
                                            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 scale-0 border-1 border-[var(--border)] items-center justify-center rounded-full bg-white hover:bg-stone-200 text-stone-500 shadow-md transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1) hover:bg-red-600 group-hover:scale-100 active:scale-90"
                                            >
                                            <X size={14} strokeWidth={2} />
                                        </button>
                                    </div>
                                )
                            })}
                            <button 
                                className={`tag-ghost pointer-events-auto cursor-pointer`} 
                                onClick={(e) => {setIsSkillsModalOpen(true)}}>
                                    + Add skill
                            </button> 
                        </div>
                        {isSkillsModalOpen && (<TagSelectModal tagState={selectedSkills} tagList={skills.map((s) => s.skill_name)} onTagToggle={toggleSkill} setModalState={setIsSkillsModalOpen} color="var(--green)"></TagSelectModal>)}
                    </div>

                    {/* Field 6: Project Types */}

                    <div className="flex flex-col gap-2 row-2 col-5 col-span-2">
                        <label className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-stone-500">
                            <Briefcase  size={14} /> Project Types
                        </label>
                        <div className='flex flex-wrap pr-2 gap-y-2'>
                            {[...selectedTypes].map((t) => {
                                return (
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
                                )
                            })}
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
                            />
                        )}
                    </div>

                </div>

                {/* Action Footer */}
                <div className="flex justify-end items-center gap-4 pb-4 border-b border-stone-200">
                    <button
                        type="button"
                        className="text-xs font-sans uppercase tracking-[0.15em] hover:text-stone-600 transition-colors text-stone-400"
                        onClick={resetFilters}
                    >
                        Reset Filters
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSearch}
                    >
                        Search
                    </button>
                </div>
                </div>
            </div>
            <div className="project-list divide-y divide-gray-200">
                {isLoading ? (
                    <div className="w-full center my-40 text-center text-gray-500">
                        Loading...
                    </div>
                ) : projects.length !== 0 ? (
                    projects.map((project, index) => (
                        <ListEntry
                            key={index}
                            project={project}
                            isOpen={openIds.includes(index)}
                            onToggle={() => toggleItem(index)}
                            isKeywordInQuery={(k) => filter["keywords"].includes(k)}
                            isKeywordSelected={(k) => selectedKeywords.has(k)}
                            onKeywordToggle={toggleKeyword}
                            highlightWord={filter["query"]}
                        />
                    ))
                ) : (
                    <div className="w-full center my-40 text-center text-gray-500">
                        Nothing here yet...<br />
                        <button
                            className="underline cursor-pointer"
                            onClick={(e) => navigate("/projects/new")}
                        >
                            Create
                        </button>
                        &nbsp;your own instead!
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
            
            {[...Array(totalPages)].map((_, i) => (
            <button
                key={i}
                disabled={page == i+1}
                onClick={() => updateParams([['page', String(i + 1)]])}
                className={`cursor-pointer disabled:cursor-default ${page === i+1 ? "font-bold text-gray-700" : "font-normal"}`}
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

        {user && <div>
            {/* 1. INVISIBLE SPACER: Ensures the last item isn't hidden behind the bar */}
            <div style={{ height: '100px' }}></div>

            {/* 2. FIXED BOTTOM BAR */}
            <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slight transparency
            borderTop: '1px solid #e5e5e5',
            backdropFilter: 'blur(5px)', // Blurs content behind it for a modern feel
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
            <button
                className="btn-primary"
                onClick={() => navigate("/projects/my-applications")}
                >
                My Applications
            </button>
            <button
                className="btn-primary"
                onClick={() => navigate("/projects/new")}
                >
                + Register New Project
            </button>
            </div>
            </div>
        </div>}
        
        </div>
    );
}