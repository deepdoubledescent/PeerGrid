import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, MapPin, Sparkles } from "lucide-react";
import { getMatchRecommendations } from "./Controller";

// Score Badge
const ScoreBadge = ({ score }) => {
    const pct = Math.round(score * 100);
    const color = pct >= 60 ? "#16a34a" : pct >= 40 ? "#d97706" : "#6b7280";
    return (
        <span
            style={{
                fontSize: 12,
                fontWeight: 700,
                color,
                background: `${color}18`,
                borderRadius: 99,
                padding: "2px 10px",
                whiteSpace: "nowrap",
            }}
        >
            {pct}% match
        </span>
    );
};

// Researcher Card
const RecommendedCard = ({ rec }) => {
    const navigate = useNavigate();
    const shortId = rec.id?.split("/").pop();

    return (
        <div
            className="card p-4 cursor-pointer hover:bg-stone-50 transition"
            onClick={() => navigate(`/profile/${shortId}`)}
        >
            <div className="flex items-start justify-between gap-4">
                {/* Avatar placeholder */}
                <div className="w-14 h-14 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-semibold shrink-0">
                    {(rec.name || "?").charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                    {/* Name + Score */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-lg font-medium hover:underline">{rec.name}</div>
                        <ScoreBadge score={rec.score} />
                    </div>

                    {/* Score breakdown */}
                    <div className="text-sm opacity-60 mt-1">
                        Topic match: {Math.round(rec.topic_score * 100)}% &nbsp;·&nbsp;
                        Paper similarity: {Math.round(rec.minilm_score * 100)}%
                    </div>

                    {/* Research summary from DB */}
                    {rec.summary && (
                        <p className="text-sm mt-2 text-stone-700">{rec.summary}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---
export default function RecommendedPeoplePage({ user }) {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // DEMO MODE: Set to a valid cognito_sub to preview that user's recommendations.
    // Set to null in production to use the logged-in user's own results.
    const DEMO_TARGET_SUB = null; // ← Demo cognito_sub here
    // Note: These results have been derived from the legacy dataset, which was collected through manual scraping.

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                const results = await getMatchRecommendations(DEMO_TARGET_SUB);
                setRecommendations(results || []);
            } catch (err) {
                console.error("Matchmaking error:", err);
                setError("Could not load recommendations. Please try again later.");
            } finally {
                setLoading(false);
            }
        };
        fetchRecommendations();
    }, []);

    return (
        <div className="p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <Sparkles size={22} />
                <h1 className="text-3xl font-semibold">Recommended Researchers</h1>
            </div>
            <p className="text-sm opacity-60 mb-8">
                Personalized matches based on your research topics and publication abstracts.
            </p>

            {/* Loading */}
            {loading && (
                <div className="text-center text-stone-500 mt-10">
                    Analyzing research profiles… this may take a few seconds.
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="text-center text-red-500 mt-10">{error}</div>
            )}

            {/* Empty */}
            {!loading && !error && recommendations.length === 0 && (
                <div className="text-center text-stone-500 mt-10">
                    No recommendations found. Make sure your OpenAlex profile is linked and has publications.
                    Also note that first generation of recommendations after sign-up can take up to 24 hours.
                </div>
            )}

            {/* Results */}
            {!loading && !error && recommendations.length > 0 && (
                <div className="space-y-4">
                    {recommendations.map((rec) => (
                        <RecommendedCard key={rec.id} rec={rec} />
                    ))}
                </div>
            )}
        </div>
    );
}
