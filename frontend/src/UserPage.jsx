import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    getAllRequiredInformationForUserPage,
    updateUserBio,
    updateUserResearchInterests,
    updateUserSkills,
    updateUserProfile,
    getAvatarUploadURL,
    toggleLikePerson,
    getLocations,
    getInstitutes,
} from './Controller';
import imageCompression from 'browser-image-compression';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import {
    Building, MapPin, GraduationCap, User, BookOpen, Lightbulb,
    Mail, Contact, ChevronDown, Brain, Pencil, Camera, Star, Heart,
    Users, Briefcase, CalendarDays, Languages, BadgeCheck, ShieldCheck
} from 'lucide-react';
import './UserPage.css';

// ============================================================================
// 1. CANVAS HELPER FUNCTION
// ============================================================================
async function getCroppedImg(imageSrc, pixelCrop) {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, 400, 400
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
    });
}

const parseLocationLabel = (value) => {
    const parts = String(value || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return { city: "", country: "" };
    }

    if (parts.length === 1) {
        return { city: "", country: parts[0] };
    }

    return {
        city: parts.slice(0, -1).join(', '),
        country: parts[parts.length - 1],
    };
};

const normalizeTagLabel = (value) =>
    String(value || '').trim().replace(/\s+/g, ' ');

const mapOptionsToSuggestions = (rows = [], keys = []) =>
    rows
        .map((item) => {
            for (const key of keys) {
                if (item?.[key]) return normalizeTagLabel(item[key]);
            }
            return normalizeTagLabel(item?.name || item?.label || item);
        })
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

const CreatableTagInput = ({
    placeholder,
    selectedItems,
    suggestions,
    inputValue,
    onInputChange,
    onAddItem,
    onRemoveItem,
    disabled,
    allowCreate = true,
    helperText = 'Pick an existing value from the list or type a new one and press Enter.',
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const normalizedSelected = selectedItems.map((item) => item.toLowerCase());
    const normalizedInput = inputValue.trim().toLowerCase();

    const filteredSuggestions = suggestions
        .filter(Boolean)
        .filter((item) => item.toLowerCase().includes(normalizedInput))
        .filter((item) => !normalizedSelected.includes(item.toLowerCase()))
        .slice(0, 8);

    const exactSuggestionMatch = suggestions.find(
        (item) => item.toLowerCase() === normalizedInput
    );

    const commitValue = (value) => {
        const cleaned = normalizeTagLabel(value);
        if (!cleaned) return;
        onAddItem(cleaned);
        onInputChange('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();

            if (!inputValue.trim()) return;

            if (allowCreate) {
                commitValue(inputValue);
            } else if (exactSuggestionMatch) {
                commitValue(exactSuggestionMatch);
            }
        } else if (e.key === 'Backspace' && !inputValue && selectedItems.length > 0) {
            onRemoveItem(selectedItems[selectedItems.length - 1]);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div
                className="tag-input-wrapper"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
            >
                {selectedItems.map((item) => (
                    <span
                        key={item}
                        className="tag-ghost"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        {item}
                        <button
                            type="button"
                            onClick={() => onRemoveItem(item)}
                            disabled={disabled}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: 'inherit',
                                padding: 0,
                                lineHeight: 1
                            }}
                        >
                            ✕
                        </button>
                    </span>
                ))}

                <input
                    className="profile-bio-textarea"
                    style={{
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        background: 'transparent',
                        padding: 0,
                        minWidth: 160,
                        flex: 1,
                        margin: 0
                    }}
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
                    placeholder={selectedItems.length === 0 ? placeholder : 'Add another and press Enter'}
                    disabled={disabled}
                />
            </div>

            <div style={{ marginTop: 6, fontSize: 12, color: '#a8a29e' }}>
                {helperText}
            </div>

            {showSuggestions && (filteredSuggestions.length > 0 || (allowCreate && inputValue.trim())) && (
                <ul
                    style={{
                        position: 'absolute',
                        width: '100%',
                        zIndex: 30,
                        background: '#fafaf9',
                        border: '1px solid #e7e5e4',
                        marginTop: 4,
                        maxHeight: 192,
                        overflowY: 'auto',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                        borderRadius: 4,
                        listStyle: 'none',
                        padding: 0
                    }}
                >
                    {filteredSuggestions.map((item) => (
                        <li
                            key={item}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => commitValue(item)}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f5f5f4'
                            }}
                        >
                            {item}
                        </li>
                    ))}

                    {allowCreate &&
                        inputValue.trim() &&
                        !filteredSuggestions.some((item) => item.toLowerCase() === inputValue.trim().toLowerCase()) &&
                        !normalizedSelected.includes(inputValue.trim().toLowerCase()) && (
                            <li
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => commitValue(inputValue)}
                                style={{ padding: '10px 12px', cursor: 'pointer' }}
                            >
                                Add “{inputValue.trim()}”
                            </li>
                        )}
                </ul>
            )}
        </div>
    );
};

// ============================================================================
// 2. CROP MODAL COMPONENT
// ============================================================================
const ImageCropModal = ({ image, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '20px', borderRadius: '12px',
                width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Position and size your photo</h3>

                <div style={{ position: 'relative', height: 300, width: '100%', backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span>Zoom</span>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        style={{ flex: 1 }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onCancel} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={() => onCropComplete(croppedAreaPixels)} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#000', color: '#fff', cursor: 'pointer' }}>
                        Save & Upload
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 3. MAIN PAGE COMPONENT
// ============================================================================
const UserPage = ({ user, setUser }) => {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [showEmail, setShowEmail] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioDraft, setBioDraft] = useState("");
    const [viewedUser, setViewedUser] = useState(null);
    const [isBootstrapping, setIsBootstrapping] = useState(true);

    const [isEditingInterests, setIsEditingInterests] = useState(false);
    const [interestSuggestions, setInterestSuggestions] = useState([]);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [interestInput, setInterestInput] = useState("");

    const [isEditingSkills, setIsEditingSkills] = useState(false);
    const [skillSuggestions, setSkillSuggestions] = useState([]);
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [skillInput, setSkillInput] = useState("");

    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [selectedLanguages, setSelectedLanguages] = useState([]);
    const [languageSuggestions, setLanguageSuggestions] = useState([]);
    const [languageInput, setLanguageInput] = useState("");

    const [titleSuggestions, setTitleSuggestions] = useState([]);
    const [titleInput, setTitleInput] = useState("");
    const [fieldSuggestions, setFieldSuggestions] = useState([]);
    const [fieldInput, setFieldInput] = useState("");

    const [positionTitleSuggestions, setPositionTitleSuggestions] = useState([]);
    const [positionTitleInput, setPositionTitleInput] = useState("");
    const [positionFieldSuggestions, setPositionFieldSuggestions] = useState([]);
    const [positionFieldInput, setPositionFieldInput] = useState("");

    const [profileDraft, setProfileDraft] = useState({
        name: "",
        institute: "",
        country: "",
        city: "",
        location: "",
        degree: "",
        field: "",
        positionTitle: "",
        positionField: "",
        email: "",
        links: [],
    });

    const [likedUserIds, setLikedUserIds] = useState([]);

    const [tempImage, setTempImage] = useState(null);
    const fileInputRef = React.useRef(null);

    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [showInstituteSuggestions, setShowInstituteSuggestions] = useState(false);
    const [instituteSuggestions, setInstituteSuggestions] = useState([]);

    const isOwnProfile = !userId || (user && String(user.id) === String(userId));
    const profileTargetId = userId || user?.id;

    const locationText = [viewedUser?.city, viewedUser?.country].filter(Boolean).join(', ');

    const hydrateFromViewedUser = (nextUser) => {
        const initialLocation = [nextUser?.city, nextUser?.country].filter(Boolean).join(", ");

        setBioDraft(nextUser?.bio || "");
        setIsEditingBio(false);

        setSelectedInterests(nextUser?.interests || []);
        setInterestInput("");
        setIsEditingInterests(false);

        setSelectedSkills(nextUser?.skills || []);
        setSkillInput("");
        setIsEditingSkills(false);

        setProfileDraft({
            name: nextUser?.name || "",
            institute: nextUser?.institute || "",
            country: nextUser?.country || "",
            city: nextUser?.city || "",
            location: initialLocation,
            degree: nextUser?.degree || "",
            field: nextUser?.field || "",
            positionTitle: nextUser?.positionTitle || "",
            positionField: nextUser?.positionField || "",
            email: nextUser?.email || "",
            links: nextUser?.links || [],
        });

        setIsEditingProfile(false);
        setShowLocationSuggestions(false);
        setLocationSuggestions([]);
        setShowInstituteSuggestions(false);
        setInstituteSuggestions([]);
        setSelectedLanguages(nextUser?.languages || []);
        setLanguageInput("");
        setTitleInput("");
        setFieldInput("");
        setPositionTitleInput("");
        setPositionFieldInput("");
    };

    const handleLocationSelect = (value) => {
        const parsed = parseLocationLabel(value);

        setProfileDraft((prev) => ({
            ...prev,
            location: value,
            city: parsed.city,
            country: parsed.country,
        }));

        setShowLocationSuggestions(false);
    };

    const handleInstituteSelect = (value) => {
        setProfileDraft((prev) => ({
            ...prev,
            institute: value,
        }));

        setShowInstituteSuggestions(false);
    };

    const handlePickAvatar = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file || !viewedUser?.id) return;

        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setTempImage(reader.result);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCropSave = async (croppedAreaPixels) => {
        if (!croppedAreaPixels || !tempImage) return;

        try {
            const croppedImageBlob = await getCroppedImg(tempImage, croppedAreaPixels);

            const fileToCompress = new File([croppedImageBlob], "avatar.webp", { type: "image/webp" });
            const options = {
                maxSizeMB: 0.2,
                maxWidthOrHeight: 400,
                useWebWorker: true,
                fileType: 'image/webp'
            };
            const compressedFile = await imageCompression(fileToCompress, options);

            const { url, publicUrl } = await getAvatarUploadURL(
                'image/webp',
                compressedFile.size
            );

            const uploadResponse = await fetch(url, {
                method: 'PUT',
                body: compressedFile,
                headers: { 'Content-Type': 'image/webp' },
            });

            if (!uploadResponse.ok) throw new Error("S3 Upload failed");

            if (setUser && user && String(user.id) === String(viewedUser.id)) {
                setUser((prev) => ({ ...prev, avatar: publicUrl }));
                setViewedUser((prev) => ({ ...prev, avatar: publicUrl }));
            } else {
                setViewedUser((prev) => ({ ...prev, avatar: publicUrl }));
            }
        } catch (err) {
            console.error("Upload workflow failed:", err);
            alert("Something went wrong during the upload.");
        } finally {
            setTempImage(null);
        }
    };

    const addUniqueItem = (items, value) => {
        const cleaned = normalizeTagLabel(value);
        if (!cleaned) return items;
        return items.some((item) => item.toLowerCase() === cleaned.toLowerCase())
            ? items
            : [...items, cleaned];
    };

    const removeItemCaseInsensitive = (items, value) =>
        items.filter((item) => item.toLowerCase() !== value.toLowerCase());

    useEffect(() => {
        let cancelled = false;

        const loadPageData = async () => {
            if (!user?.id) {
                setViewedUser(null);
                setIsBootstrapping(false);
                return;
            }

            setIsBootstrapping(true);

            try {
                const targetUserId = userId || user.id;
                const pageData = await getAllRequiredInformationForUserPage(targetUserId);

                if (cancelled) return;

                const nextUser = pageData?.profile || null;
                const formOptions = pageData?.formOptions || {};

                setViewedUser(nextUser);
                setLikedUserIds(pageData?.likedUserIds || []);

                setInterestSuggestions(
                    mapOptionsToSuggestions(formOptions.topics || [], ['topic_name'])
                );

                setSkillSuggestions(
                    mapOptionsToSuggestions(formOptions.skills || [], ['skill_name'])
                );

                setLanguageSuggestions(
                    mapOptionsToSuggestions(formOptions.languages || [], ['language_name'])
                );

                setTitleSuggestions(
                    mapOptionsToSuggestions(formOptions.titles || [], ['title_name'])
                );

                setFieldSuggestions(
                    mapOptionsToSuggestions(formOptions.fields || [], ['field_name'])
                );

                setPositionTitleSuggestions(
                    mapOptionsToSuggestions(formOptions.positionTitles || [], ['position_title_name'])
                );

                setPositionFieldSuggestions(
                    mapOptionsToSuggestions(formOptions.positionFields || [], ['position_field_name'])
                );

                hydrateFromViewedUser(nextUser);
            } catch (error) {
                console.error("Failed to bootstrap user page:", error);
                if (!cancelled) {
                    setViewedUser(null);
                    setLikedUserIds([]);
                    setInterestSuggestions([]);
                    setSkillSuggestions([]);
                    setLanguageSuggestions([]);
                    setTitleSuggestions([]);
                    setFieldSuggestions([]);
                    setPositionTitleSuggestions([]);
                    setPositionFieldSuggestions([]);
                }
            } finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        };

        loadPageData();

        return () => {
            cancelled = true;
        };
    }, [user?.id, userId]);

    useEffect(() => {
        let cancelled = false;

        if (!showLocationSuggestions || !isEditingProfile || !user?.id) return;

        const timeoutId = setTimeout(async () => {
            const value = String(profileDraft.location || '').trim();

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
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [profileDraft.location, showLocationSuggestions, isEditingProfile, user?.id]);

    useEffect(() => {
        let cancelled = false;

        if (!showInstituteSuggestions || !isEditingProfile || !user?.id) return;

        const timeoutId = setTimeout(async () => {
            const value = String(profileDraft.institute || "").trim();

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
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [profileDraft.institute, showInstituteSuggestions, isEditingProfile, user?.id]);

    const handleSaveInterests = async () => {
        if (!viewedUser?.id) return;
        const interests = selectedInterests;
        try {
            const updated = await updateUserResearchInterests({ interests });
            setViewedUser(updated);
            hydrateFromViewedUser(updated);
            setUser(updated);
            setIsEditingInterests(false);
        } catch (e) {
            console.error("Failed to update interests:", e);
        }
    };

    const handleSaveSkills = async () => {
        if (!viewedUser?.id) return;
        const skills = selectedSkills;
        try {
            const updated = await updateUserSkills({ skills });
            setViewedUser(updated);
            hydrateFromViewedUser(updated);
            setUser(updated);
            setIsEditingSkills(false);
        } catch (e) {
            console.error("Failed to update skills:", e);
        }
    };

    const handleToggleLikeUser = async (e) => {
        e.stopPropagation();

        if (!user || !viewedUser) {
            alert("Login is required to like a researcher.");
            return;
        }

        try {
            const { liked } = await toggleLikePerson(viewedUser.id);

            if (liked) {
                setLikedUserIds((prev) =>
                    prev.includes(viewedUser.id) ? prev : [...prev, viewedUser.id]
                );
            } else {
                setLikedUserIds((prev) => prev.filter((id) => id !== viewedUser.id));
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    };

    const handleSaveBio = async () => {
        const updatedBio = bioDraft.trimEnd();
        try {
            const updated = await updateUserBio({ bio: updatedBio });
            setViewedUser(updated);
            hydrateFromViewedUser(updated);
            setUser(updated);
            setIsEditingBio(false);
        } catch (e) {
            console.error("Failed to update bio:", e);
        }
    };

    const addProfileLink = () => {
        setProfileDraft((prev) => ({
            ...prev,
            links: [...(prev.links || []), { text: "", url: "" }],
        }));
    };

    const updateProfileLink = (index, patch) => {
        setProfileDraft((prev) => ({
            ...prev,
            links: (prev.links || []).map((link, i) =>
                i === index ? { ...link, ...patch } : link
            ),
        }));
    };

    const removeProfileLink = (index) => {
        setProfileDraft((prev) => ({
            ...prev,
            links: (prev.links || []).filter((_, i) => i !== index),
        }));
    };

    const handleSaveProfile = async () => {
        if (!viewedUser?.id) return;

        const parsedLocation = parseLocationLabel(profileDraft.location);

        try {
            const updated = await updateUserProfile({
                patch: {
                    name: profileDraft.name.trim(),
                    institute: profileDraft.institute.trim(),
                    country: parsedLocation.country.trim(),
                    city: parsedLocation.city.trim(),
                    degree: profileDraft.degree.trim(),
                    field: profileDraft.field.trim(),
                    positionTitle: profileDraft.positionTitle.trim(),
                    positionField: profileDraft.positionField.trim(),
                    email: profileDraft.email.trim(),
                    languages: selectedLanguages,
                    links: (profileDraft.links || [])
                        .map(link => ({
                            text: String(link.text || '').trim(),
                            url: String(link.url || '').trim(),
                        }))
                        .filter(link => link.text && link.url),
                },
            });
            setViewedUser(updated);
            hydrateFromViewedUser(updated);
            setUser(updated);
            setIsEditingProfile(false);
            setShowLocationSuggestions(false);
            setShowInstituteSuggestions(false);
        } catch (e) {
            console.error("Failed to update profile:", e);
        }
    };

    if (isBootstrapping) {
        return <div className="p-6 max-w-3xl mx-auto"><div className="mt-6">Loading profile...</div></div>;
    }

    if (!user?.id) {
        return <div className="p-6 max-w-3xl mx-auto"><div className="mt-6">Please log in to view this page.</div></div>;
    }

    if (!viewedUser) {
        return <div className="p-6 max-w-3xl mx-auto"><div className="mt-6">No user found.</div></div>;
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 }
    };

    return (
        <motion.div
            className="user-page-container"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {tempImage && (
                <ImageCropModal
                    image={tempImage}
                    onCropComplete={handleCropSave}
                    onCancel={() => setTempImage(null)}
                />
            )}

            <div className="profile-layout">
                <aside className="profile-sidebar">
                    <div className="profile-avatar-large avatar-wrapper">
                        {viewedUser.avatar ? (
                            <img src={viewedUser.avatar} alt={`${viewedUser.name} avatar`} className="profile-avatar-img" />
                        ) : (
                            <User size={64} strokeWidth={1.5} />
                        )}

                        {isOwnProfile && (
                            <>
                                <button className="avatar-edit-btn" onClick={handlePickAvatar} aria-label="Change profile picture" title="Change profile picture">
                                    <Camera size={16} />
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarFileChange} />
                            </>
                        )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        {!isEditingProfile ? (
                            <>
                                {viewedUser.verified ? (
                                    <BadgeCheck
                                        size={24}
                                        className="verified-badge"
                                        style={{ color: "#1d9bf0" }}
                                    />
                                ) : null}

                                <h1 className="profile-name-h1" style={{ margin: 0 }}>
                                    {viewedUser.name}
                                </h1>

                                {isOwnProfile ? (
                                    <button
                                        className="profile-bio-edit-btn"
                                        onClick={() => setIsEditingProfile(true)}
                                        aria-label="Edit profile"
                                        title="Edit profile"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                ) : user ? (
                                    <button
                                        className={`bookmark-btn ${likedUserIds.includes(viewedUser.id) ? 'active' : ''}`}
                                        onClick={handleToggleLikeUser}
                                        aria-label="Like researcher"
                                        title="Like researcher"
                                    >
                                        <Star
                                            size={20}
                                            fill={likedUserIds.includes(viewedUser.id) ? "currentColor" : "none"}
                                        />
                                    </button>
                                ) : null}
                            </>
                        ) : (
                            <input
                                className="profile-bio-textarea"
                                value={profileDraft.name}
                                onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Name"
                            />
                        )}
                    </div>

                    {!isEditingProfile ? (
                        <div className="profile-summary">
                            <div className="summary-item"><Building size={18} /><span>{viewedUser.institute}</span></div>
                            <div className="summary-item">
                                <Briefcase size={18} />
                                <span>
                                    {viewedUser.positionTitle
                                        ? viewedUser.positionField
                                            ? `${viewedUser.positionTitle} in ${viewedUser.positionField}`
                                            : viewedUser.positionTitle
                                        : '—'}
                                </span>
                            </div>
                            <div className="summary-item"><MapPin size={18} /><span>{locationText || '—'}</span></div>
                            <div className="summary-item">
                                <GraduationCap size={18} />
                                <span>
                                    {viewedUser.degree
                                        ? viewedUser.field
                                            ? `${viewedUser.degree} in ${viewedUser.field}`
                                            : viewedUser.degree
                                        : '—'}
                                </span>
                            </div>
                            <div className="summary-item">
                                <Languages size={18} />
                                <span>{viewedUser.languages?.length ? viewedUser.languages.join(', ') : '—'}</span>
                            </div>
                            <div className="email-accordion">
                                <div className="summary-item clickable" onClick={() => setShowEmail(!showEmail)}>
                                    <Contact size={18} /><span>Contact</span><ChevronDown size={12} />
                                </div>
                                <div className={`accordion-content ${showEmail ? 'is-open' : ''}`}>
                                    <div className='summary-item'><Mail size={18} /><span>{viewedUser.email}</span></div>
                                    {(viewedUser.links || []).map((link) => (
                                        <div key={link.id || `${link.text}-${link.url}`} className='summary-item'>
                                            <Contact size={18} />
                                            <a href={link.url} target="_blank" rel="noreferrer" className="underline break-all">
                                                {link.text}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="profile-bio-editor">
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="profile-bio-textarea"
                                    value={profileDraft.institute}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setProfileDraft((p) => ({ ...p, institute: value }));
                                        setShowInstituteSuggestions(true);
                                    }}
                                    onFocus={() => setShowInstituteSuggestions(true)}
                                    onBlur={() => {
                                        setTimeout(() => setShowInstituteSuggestions(false), 150);
                                    }}
                                    placeholder="Institute"
                                />

                                {showInstituteSuggestions && (
                                    <ul
                                        style={{
                                            position: 'absolute',
                                            width: '100%',
                                            zIndex: 30,
                                            background: '#fafaf9',
                                            border: '1px solid #e7e5e4',
                                            marginTop: 4,
                                            maxHeight: 192,
                                            overflowY: 'auto',
                                            boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                                            borderRadius: 4,
                                            listStyle: 'none',
                                            padding: 0
                                        }}
                                    >
                                        {instituteSuggestions.length > 0 ? (
                                            instituteSuggestions.map((item) => (
                                                <li
                                                    key={item.id ?? item.label}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => handleInstituteSelect(item.label)}
                                                    style={{
                                                        padding: '10px 12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f5f5f4'
                                                    }}
                                                >
                                                    {item.label}
                                                </li>
                                            ))
                                        ) : (
                                            <li style={{ padding: '10px 12px', color: '#a8a29e', fontStyle: 'italic' }}>
                                                No matches found
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className="education-row">
                                <CreatableTagInput
                                    placeholder="Current position title"
                                    selectedItems={profileDraft.positionTitle ? [profileDraft.positionTitle] : []}
                                    suggestions={positionTitleSuggestions}
                                    inputValue={positionTitleInput}
                                    onInputChange={setPositionTitleInput}
                                    onAddItem={(value) =>
                                        setProfileDraft((prev) => ({ ...prev, positionTitle: value }))
                                    }
                                    onRemoveItem={() =>
                                        setProfileDraft((prev) => ({ ...prev, positionTitle: "" }))
                                    }
                                    allowCreate={true}
                                    helperText="Choose an existing title or type your own."
                                />

                                <CreatableTagInput
                                    placeholder="Current field / domain"
                                    selectedItems={profileDraft.positionField ? [profileDraft.positionField] : []}
                                    suggestions={positionFieldSuggestions}
                                    inputValue={positionFieldInput}
                                    onInputChange={setPositionFieldInput}
                                    onAddItem={(value) =>
                                        setProfileDraft((prev) => ({ ...prev, positionField: value }))
                                    }
                                    onRemoveItem={() =>
                                        setProfileDraft((prev) => ({ ...prev, positionField: "" }))
                                    }
                                    allowCreate={true}
                                    helperText="Optional: Biology, Machine Learning, Computer Science..."
                                />
                            </div>

                            <div style={{ position: 'relative' }}>
                                <input
                                    className="profile-bio-textarea"
                                    value={profileDraft.location}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setProfileDraft((p) => ({ ...p, location: value }));
                                        setShowLocationSuggestions(true);
                                    }}
                                    onFocus={() => setShowLocationSuggestions(true)}
                                    onBlur={() => {
                                        setTimeout(() => setShowLocationSuggestions(false), 150);
                                    }}
                                    placeholder="City, Country or Country"
                                />

                                {showLocationSuggestions && (
                                    <ul
                                        style={{
                                            position: 'absolute',
                                            width: '100%',
                                            zIndex: 30,
                                            background: '#fafaf9',
                                            border: '1px solid #e7e5e4',
                                            marginTop: 4,
                                            maxHeight: 192,
                                            overflowY: 'auto',
                                            boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                                            borderRadius: 4,
                                            listStyle: 'none',
                                            padding: 0
                                        }}
                                    >
                                        {locationSuggestions.length > 0 ? (
                                            locationSuggestions.map((item) => (
                                                <li
                                                    key={`${item.type}-${item.label}`}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => handleLocationSelect(item.label)}
                                                    style={{
                                                        padding: '10px 12px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f5f5f4'
                                                    }}
                                                >
                                                    {item.label}
                                                </li>
                                            ))
                                        ) : (
                                            <li style={{ padding: '10px 12px', color: '#a8a29e', fontStyle: 'italic' }}>
                                                No matches found
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className="education-row">
                                <CreatableTagInput
                                    placeholder="Select education level"
                                    selectedItems={profileDraft.degree ? [profileDraft.degree] : []}
                                    suggestions={titleSuggestions}
                                    inputValue={titleInput}
                                    onInputChange={setTitleInput}
                                    onAddItem={(value) =>
                                        setProfileDraft((prev) => ({ ...prev, degree: value }))
                                    }
                                    onRemoveItem={() =>
                                        setProfileDraft((prev) => ({ ...prev, degree: "" }))
                                    }
                                    allowCreate={false}
                                    helperText="Choose from existing education levels."
                                />

                                <CreatableTagInput
                                    placeholder="Field of study"
                                    selectedItems={profileDraft.field ? [profileDraft.field] : []}
                                    suggestions={fieldSuggestions}
                                    inputValue={fieldInput}
                                    onInputChange={setFieldInput}
                                    onAddItem={(value) =>
                                        setProfileDraft((prev) => ({ ...prev, field: value }))
                                    }
                                    onRemoveItem={() =>
                                        setProfileDraft((prev) => ({ ...prev, field: "" }))
                                    }
                                    allowCreate={true}
                                    helperText="Choose an existing field or type your own."
                                />
                            </div>

                            <CreatableTagInput
                                placeholder="Select languages"
                                selectedItems={selectedLanguages}
                                suggestions={languageSuggestions}
                                inputValue={languageInput}
                                onInputChange={setLanguageInput}
                                onAddItem={(value) => setSelectedLanguages((prev) => addUniqueItem(prev, value))}
                                onRemoveItem={(value) => setSelectedLanguages((prev) => removeItemCaseInsensitive(prev, value))}
                                allowCreate={false}
                                helperText="Choose from existing languages."
                            />

                            <input
                                className="profile-bio-textarea"
                                value={profileDraft.email}
                                onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))}
                                placeholder="Contact Email"
                            />

                            <div className="profile-bio-editor">
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>External Links</div>

                                {(profileDraft.links || []).map((link, index) => (
                                    <div key={index} style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                                        <input
                                            className="profile-bio-textarea"
                                            value={link.text || ""}
                                            onChange={(e) => updateProfileLink(index, { text: e.target.value })}
                                            placeholder="Link label (e.g. LinkedIn, GitHub)"
                                        />
                                        <input
                                            className="profile-bio-textarea"
                                            value={link.url || ""}
                                            onChange={(e) => updateProfileLink(index, { url: e.target.value })}
                                            placeholder="https://..."
                                        />
                                        <button
                                            type="button"
                                            className="profile-bio-cancel-btn"
                                            onClick={() => removeProfileLink(index)}
                                        >
                                            Remove link
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    className="profile-bio-save-btn"
                                    onClick={addProfileLink}
                                >
                                    Add link
                                </button>
                            </div>

                            <div className="profile-bio-actions">
                                <button className="profile-bio-save-btn" onClick={handleSaveProfile}>Save</button>
                                <button
                                    className="profile-bio-cancel-btn"
                                    onClick={() => hydrateFromViewedUser(viewedUser)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="profile-bio-section">
                        <div className="profile-bio-header">
                            <h2 className="profile-bio-title">Bio</h2>
                            {isOwnProfile && !isEditingBio && (
                                <button className="profile-bio-edit-btn" onClick={() => setIsEditingBio(true)} aria-label="Edit bio" title="Edit bio">
                                    <Pencil size={16} />
                                </button>
                            )}
                        </div>

                        {!isEditingBio && (
                            <div className="profile-summary">
                                {viewedUser?.bio && viewedUser.bio.trim() !== "" ? viewedUser.bio : <span className="profile-bio-empty">No bio yet.</span>}
                            </div>
                        )}

                        {isEditingBio && (
                            <div className="profile-bio-editor">
                                <textarea
                                    className="profile-bio-textarea"
                                    value={bioDraft}
                                    onChange={(e) => setBioDraft(e.target.value)}
                                    placeholder="Write something about yourself…"
                                    maxLength={300}
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                            handleSaveBio();
                                        }
                                        if (e.key === "Escape") {
                                            setBioDraft(viewedUser?.bio || "");
                                            setIsEditingBio(false);
                                        }
                                    }}
                                />
                                <div className="profile-bio-actions">
                                    <button className="profile-bio-save-btn" onClick={handleSaveBio}>Save</button>
                                    <button className="profile-bio-cancel-btn" onClick={() => { setBioDraft(viewedUser?.bio || ""); setIsEditingBio(false); }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isOwnProfile ? (
                        <div className="profile-footer-actions">
                            <Link to="/setup/openalex" className="summary-item utility-link">
                                <ShieldCheck size={18} />
                                <span>Verify / Reset Account Info</span>
                            </Link>
                        </div>
                    ) : null}
                </aside>

                <main className="profile-main-content">
                    <section>
                        <div className="profile-bio-header">
                            <h2 className="profile-section-title"> <Lightbulb size={20} /> Research Interests </h2>
                            {isOwnProfile && !isEditingInterests && (
                                <button className="profile-bio-edit-btn" onClick={() => setIsEditingInterests(true)} aria-label="Edit research interests" title="Edit research interests">
                                    <Pencil size={16} />
                                </button>
                            )}
                        </div>
                        {!isEditingInterests ? (
                            <div className="interests-cloud">
                                {viewedUser.interests?.length ? viewedUser.interests.map((i) => (<span key={i} className="tag-ghost">{i}</span>)) : <span className="no-data-text">No interests listed</span>}
                            </div>
                        ) : (
                            <div className="profile-bio-editor">
                                <CreatableTagInput
                                    placeholder="Select or add interests"
                                    selectedItems={selectedInterests}
                                    suggestions={interestSuggestions}
                                    inputValue={interestInput}
                                    onInputChange={setInterestInput}
                                    onAddItem={(value) => {
                                        setSelectedInterests((prev) => addUniqueItem(prev, value));
                                        setInterestSuggestions((prev) => addUniqueItem(prev, value).sort((a, b) => a.localeCompare(b)));
                                    }}
                                    onRemoveItem={(value) => setSelectedInterests((prev) => removeItemCaseInsensitive(prev, value))}
                                />
                                <div className="profile-bio-actions">
                                    <button className="profile-bio-save-btn" onClick={handleSaveInterests}>Save</button>
                                    <button className="profile-bio-cancel-btn" onClick={() => { setSelectedInterests(viewedUser?.interests || []); setInterestInput(""); setIsEditingInterests(false); }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="mt-8">
                        <div className="profile-bio-header">
                            <h2 className="profile-section-title"> <Brain size={20} /> Skills </h2>
                            {isOwnProfile && !isEditingSkills && (
                                <button className="profile-bio-edit-btn" onClick={() => setIsEditingSkills(true)} aria-label="Edit skills" title="Edit skills">
                                    <Pencil size={16} />
                                </button>
                            )}
                        </div>
                        {!isEditingSkills ? (
                            <div className="interests-cloud">
                                {viewedUser.skills?.length ? viewedUser.skills.map((s) => (<span key={s} className="tag-ghost">{s}</span>)) : <span className="no-data-text">No skills listed</span>}
                            </div>
                        ) : (
                            <div className="profile-bio-editor">
                                <CreatableTagInput
                                    placeholder="Select or add skills"
                                    selectedItems={selectedSkills}
                                    suggestions={skillSuggestions}
                                    inputValue={skillInput}
                                    onInputChange={setSkillInput}
                                    onAddItem={(value) => {
                                        setSelectedSkills((prev) => addUniqueItem(prev, value));
                                        setSkillSuggestions((prev) => addUniqueItem(prev, value).sort((a, b) => a.localeCompare(b)));
                                    }}
                                    onRemoveItem={(value) => setSelectedSkills((prev) => removeItemCaseInsensitive(prev, value))}
                                />
                                <div className="profile-bio-actions">
                                    <button className="profile-bio-save-btn" onClick={handleSaveSkills}>Save</button>
                                    <button className="profile-bio-cancel-btn" onClick={() => { setSelectedSkills(viewedUser?.skills || []); setSkillInput(""); setIsEditingSkills(false); }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="mt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {isOwnProfile && (
                                <motion.button
                                    type="button"
                                    className="project-card-mini text-left md:col-span-2"
                                    variants={itemVariants}
                                    whileHover={{ y: -3 }}
                                    onClick={() => navigate(`/people/network`)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <Users size={20} />
                                        <h3 style={{ margin: 0 }}>My Network</h3>
                                    </div>
                                    <p>
                                        View your following and connections.
                                    </p>
                                </motion.button>
                            )}

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() => navigate(`/profile/${profileTargetId}/projects`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <BookOpen size={20} />
                                    <h3 style={{ margin: 0 }}>{isOwnProfile ? "My Projects" : "User's Projects"}</h3>
                                </div>
                                <p>
                                    View published and completed projects.
                                </p>
                            </motion.button>

                            {isOwnProfile && (
                                <motion.button
                                    type="button"
                                    className="project-card-mini text-left"
                                    variants={itemVariants}
                                    whileHover={{ y: -3 }}
                                    onClick={() => navigate(`/projects/my-applications`)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <Briefcase size={20} />
                                        <h3 style={{ margin: 0 }}>My Project Applications</h3>
                                    </div>
                                    <p>
                                        Projects you have applied to.
                                    </p>
                                </motion.button>
                            )}

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() => navigate(`/profile/${profileTargetId}/liked-projects`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Heart size={20} />
                                    <h3 style={{ margin: 0 }}>Liked Projects</h3>
                                </div>
                                <p>
                                    Projects this user has saved.
                                </p>
                            </motion.button>

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() => navigate(`/profile/${profileTargetId}/liked-papers`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <BookOpen size={20} />
                                    <h3 style={{ margin: 0 }}>Liked Papers</h3>
                                </div>
                                <p>
                                    Academic papers this user liked.
                                </p>
                            </motion.button>

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() => navigate(`/profile/${profileTargetId}/posts`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <BookOpen size={20} />
                                    <h3 style={{ margin: 0 }}>{isOwnProfile ? "My Posts" : "User's Posts"}</h3>
                                </div>
                                <p>
                                    View all posts by this user.
                                </p>
                            </motion.button>

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() => navigate(`/profile/${profileTargetId}/liked-posts`)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <Heart size={20} />
                                    <h3 style={{ margin: 0 }}>Liked Posts</h3>
                                </div>
                                <p>
                                    Posts this user has liked.
                                </p>
                            </motion.button>

                            <motion.button
                                type="button"
                                className="project-card-mini text-left"
                                variants={itemVariants}
                                whileHover={{ y: -3 }}
                                onClick={() =>
                                    navigate(isOwnProfile ? `/events/my` : `/profile/${profileTargetId}/events`)
                                }
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <CalendarDays size={20} />
                                    <h3 style={{ margin: 0 }}>{isOwnProfile ? "My Events" : "User's Events"}</h3>
                                </div>
                                <p>
                                    {isOwnProfile
                                        ? "View and manage events you created."
                                        : "View events created by this user."}
                                </p>
                            </motion.button>

                            {isOwnProfile && (
                                <motion.button
                                    type="button"
                                    className="project-card-mini text-left"
                                    variants={itemVariants}
                                    whileHover={{ y: -3 }}
                                    onClick={() => navigate(`/events/registered`)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <CalendarDays size={20} />
                                        <h3 style={{ margin: 0 }}>Registered Events</h3>
                                    </div>
                                    <p>
                                        Events you have registered for.
                                    </p>
                                </motion.button>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </motion.div>
    );
};

export default UserPage;