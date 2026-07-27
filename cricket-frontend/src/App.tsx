import { useState, useEffect } from 'react';
import { pb, getUserRole } from './services/pocketbase';
import type { Match, Team, Player, News, TournamentConfig } from './services/pocketbase';
import { Navbar } from './components/Navbar';
import { LiveScorecard } from './components/LiveScorecard';
import { Bracket } from './components/Bracket';
import { StatsLeaderboard } from './components/StatsLeaderboard';
import { ScoreboardDisplay } from './components/ScoreboardDisplay';
import { AdminScorer } from './components/AdminScorer';
import { AdminLogin } from './components/AdminLogin';
import { PreTournamentTeaser } from './components/PreTournamentTeaser';
import { NewsView } from './components/NewsView';
import { FantasyLeague } from './components/FantasyLeague';
import { Loader2 } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig | null>(null);

  const [isConnected, setIsConnected] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Authenticate admin check
  const checkAdminStatus = () => {
    setIsAdmin(pb.authStore.isValid && pb.authStore.model !== null);
  };

  useEffect(() => {
    if (isAdmin) {
      const role = getUserRole();
      if (role === 'display') {
        setActiveTab('display');
      }
    }
  }, [isAdmin]);

  const handleLogout = () => {
    pb.authStore.clear();
    setIsAdmin(false);
    setActiveTab('dashboard');
  };

  // Fetch initial collections
  const fetchData = async (isFirstLoad = false) => {
    try {
      if (isFirstLoad) setIsLoading(true);
      const matchRecords = await pb.collection('matches').getFullList<Match>({
        sort: '+created',
        expand: 'team1,team2,winner'
      });
      const teamRecords = await pb.collection('teams').getFullList<Team>({
        expand: 'captain'
      });
      const playerRecords = await pb.collection('players').getFullList<Player>();
      const newsRecords = await pb.collection('news').getFullList<News>({
        sort: '-created'
      });
      const configRecords = await pb.collection('tournament_config').getFullList<TournamentConfig>({
        expand: 'man_of_the_series,man_of_the_series.team'
      });

      setMatches(matchRecords);
      setTeams(teamRecords);
      setPlayers(playerRecords);
      setNews(newsRecords);
      setTournamentConfig(configRecords[0] || null);
      setIsConnected(true);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setIsConnected(false);
    } finally {
      if (isFirstLoad) setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
    fetchData(true);

    // Subscribe to database changes for real-time updates
    pb.collection('matches').subscribe('*', () => fetchData());
    pb.collection('teams').subscribe('*', () => fetchData());
    pb.collection('players').subscribe('*', () => fetchData());
    pb.collection('news').subscribe('*', () => fetchData());
    pb.collection('tournament_config').subscribe('*', () => fetchData());

    // Fallback polling interval (10s) in case Cloudflare HTTP/3 QUIC protocol drops real-time SSE stream
    const pollInterval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      pb.collection('matches').unsubscribe('*');
      pb.collection('teams').unsubscribe('*');
      pb.collection('players').unsubscribe('*');
      pb.collection('news').unsubscribe('*');
      pb.collection('tournament_config').unsubscribe('*');
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase mt-4">
          Loading CricTourney Dashboard...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 relative pb-12">

      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header / Navbar */}
      {getUserRole() !== 'display' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isConnected={isConnected}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-6">

        {matches.length === 0 && activeTab !== 'admin' && activeTab !== 'news' && activeTab !== 'display' ? (
          <PreTournamentTeaser
            tab={activeTab}
            teams={teams}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <LiveScorecard
                matches={matches}
                teams={teams}
                players={players}
                tournamentConfig={tournamentConfig}
              />
            )}

            {activeTab === 'bracket' && (
              <Bracket
                matches={matches}
                teams={teams}
              />
            )}

            {activeTab === 'stats' && (
              <StatsLeaderboard
                players={players}
                teams={teams}
                matches={matches}
                tournamentConfig={tournamentConfig}
              />
            )}

            {activeTab === 'news' && (
              <NewsView newsList={news} />
            )}

            {activeTab === 'fantasy' && (
              <FantasyLeague
                players={players}
                teams={teams}
                matches={matches}
                isConnected={isConnected}
                tournamentConfig={tournamentConfig}
              />
            )}

            {activeTab === 'display' && (
              <ScoreboardDisplay
                matches={matches}
                teams={teams}
                players={players}
                tournamentConfig={tournamentConfig}
              />
            )}
          </>
        )}

        {activeTab === 'admin' && (
          isAdmin ? (
            <AdminScorer
              matches={matches}
              teams={teams}
              players={players}
              refreshData={fetchData}
              tournamentConfig={tournamentConfig}
            />
          ) : (
            <AdminLogin
              onLoginSuccess={() => {
                setIsAdmin(true);
                fetchData();
              }}
            />
          )
        )}

      </main>

      {/* Footer */}
      {getUserRole() !== 'display' && (
        <footer className="w-full border-t border-slate-900/60 mt-12 py-6 px-4 md:px-8 text-center bg-slate-950/20 backdrop-blur-sm relative z-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p className="m-0 font-medium">
              Trischel Sports Encounter 2026 &copy; All Rights Reserved.
            </p>
            <p className="m-0 flex items-center gap-1.5 justify-center">
              <span>Developed by</span>
              <span className="font-semibold text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                IT Department, Trischel Fabric (Pvt) Ltd
              </span>
            </p>
          </div>
        </footer>
      )}

      {/* Floating Logout Button for Display View */}
      {getUserRole() === 'display' && (
        <button
          onClick={handleLogout}
          className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-xl text-[10px] text-slate-400 hover:text-rose-400 font-bold uppercase transition-all shadow-lg"
        >
          Logout Display
        </button>
      )}

    </div>
  );
}

export default App;
