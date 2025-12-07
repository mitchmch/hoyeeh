
import React, { useEffect, useState } from 'react';
import { User, Content } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import { Button } from './Button';
import { useDownload, DownloadItem } from '../contexts/DownloadContext';
import { ContentCard } from './ContentCard';

interface UserDashboardProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
  onPlay: (item: Content, progress: number) => void;
  deferredPrompt?: any; // PWA Install Prompt
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ user, onBack, onLogout, onPlay, deferredPrompt }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'mylist' | 'downloads' | 'settings' | 'billing'>('overview');
  const [history, setHistory] = useState<{content: Content, progress: number}[]>([]);
  const [downloads, setDownloads] = useState<{id: string, content: Content, downloadDate: number}[]>([]);
  const [myList, setMyList] = useState<Content[]>([]);
  const [storageUsage, setStorageUsage] = useState<{usage: number, quota: number} | null>(null);
  
  const { activeDownloads, cancelDownload, removeDownload } = useDownload();

  // Settings State
  const [newPin, setNewPin] = useState('');
  const [newSecret, setNewSecret] = useState('');

  useEffect(() => {
    loadHistory();
    loadDownloads();
    loadMyList();
  }, [activeTab, activeDownloads]); 

  const loadHistory = async () => {
    try {
        const data = await api.user.getContinueWatching();
        setHistory(data);
    } catch (err) {
        console.error("Failed to load history");
    }
  };

  const loadDownloads = async () => {
    const data = await offlineStorage.getAllDownloads();
    setDownloads(data);
    
    // Check storage usage
    const estimate = await offlineStorage.getStorageEstimate();
    if (estimate) {
        setStorageUsage({ usage: estimate.usage || 0, quota: estimate.quota || 1 });
    }
  };

  const loadMyList = async () => {
      try {
          const data = await api.user.getMyList();
          setMyList(data);
      } catch (e) { console.error("Failed to load list"); }
  };

  const handleClearHistory = async () => {
      if(!window.confirm("Are you sure you want to clear your entire watch history?")) return;
      try {
          await api.user.clearHistory();
          setHistory([]);
          alert("History cleared.");
      } catch (e) { alert("Failed to clear history"); }
  };

  const handleDeleteDownload = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!window.confirm("Delete this download?")) return;
    await removeDownload(id);
    loadDownloads();
  };

  const handleClearAllDownloads = async () => {
    if(!window.confirm("Delete ALL downloaded content? This cannot be undone.")) return;
    await offlineStorage.clearAllDownloads();
    loadDownloads();
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin && !newSecret) return;
    
    try {
        await api.user.changeSettings(newPin || undefined, newSecret || undefined);
        alert("Settings updated successfully!");
        setNewPin('');
        setNewSecret('');
    } catch (err: any) {
        alert(err.message || "Failed to update settings");
    }
  };

  const handleCancelSub = async () => {
    if (!window.confirm("Are you sure you want to cancel your Premium subscription?")) return;
    try {
        await api.user.cancelSubscription();
        alert("Subscription cancelled.");
        window.location.reload(); 
    } catch (err) {
        alert("Failed to cancel subscription");
    }
  };

  const handleInstallApp = () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                  console.log('User accepted the install prompt');
              }
          });
      }
  };

  const activeDownloadList = Object.values(activeDownloads) as DownloadItem[];

  // Helper for formatting bytes
  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-black pt-20 px-4 pb-10">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="mb-6 text-gray-400 flex items-center gap-2 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back to Home
        </button>

        <div className="bg-dark-card border border-gray-800 rounded-xl overflow-hidden mb-8 shadow-2xl">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-black">
                <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-3xl font-bold text-white shadow-lg ring-4 ring-black/50">
                    {user.mobileNumber.slice(-2)}
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-2xl font-bold text-white mb-1">My Account</h2>
                    <p className="text-gray-400 font-mono">{user.mobileNumber}</p>
                    <div className="mt-2 flex gap-2 justify-center md:justify-start">
                        {user.isSubscribed ? 
                            <span className="bg-brand text-white px-3 py-1 rounded-full text-xs font-bold border border-white/10 shadow-glow">PREMIUM MEMBER</span> :
                            <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs font-bold">FREE PLAN</span>
                        }
                    </div>
                </div>
                <div className="md:ml-auto">
                    <Button variant="outline" onClick={onLogout} className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white">Sign Out</Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-800 overflow-x-auto no-scrollbar">
                {['overview', 'mylist', 'downloads', 'settings', 'billing'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-4 px-4 text-sm font-bold uppercase tracking-wider transition hover:bg-white/5 whitespace-nowrap ${activeTab === tab ? 'text-brand border-b-2 border-brand bg-white/5' : 'text-gray-400'}`}
                    >
                        {tab.replace('mylist', 'My List')}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 min-h-[400px]">
                {activeTab === 'overview' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Continue Watching</h3>
                            {history.length > 0 && (
                                <button onClick={handleClearHistory} className="text-xs text-red-500 hover:text-red-400 font-bold">Clear History</button>
                            )}
                        </div>
                        {history.length === 0 ? (
                            <p className="text-gray-500 text-sm">You haven't watched anything yet.</p>
                        ) : (
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x">
                                {history.map((item, idx) => (
                                    <div key={idx} className="flex-none w-[200px] group cursor-pointer" onClick={() => onPlay(item.content, item.progress)}>
                                        <div className="aspect-video relative rounded-lg overflow-hidden mb-2 bg-gray-800 border border-gray-700">
                                            <img src={item.content.thumbnailUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition">
                                                <svg className="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                                                <div className="h-full bg-brand" style={{ width: `${(item.progress / (item.content.duration || 3600)) * 100}%` }}></div>
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-bold text-white truncate">{item.content.title}</h4>
                                        <p className="text-xs text-gray-500">{Math.floor(item.progress / 60)}m watched</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-between">
                            <div>
                                <h4 className="text-white font-bold">Security</h4>
                                <p className="text-gray-500 text-xs">Update your PIN regularly</p>
                            </div>
                            <Button variant="secondary" className="text-xs py-2" onClick={() => setActiveTab('settings')}>Change PIN</Button>
                        </div>
                    </div>
                )}

                {activeTab === 'mylist' && (
                     <div className="animate-fade-in">
                        <h3 className="text-lg font-bold text-white mb-4">My Watchlist</h3>
                        {myList.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                Your list is empty.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {myList.map(item => (
                                    <ContentCard key={item.id} item={item} onClick={() => onPlay(item, 0)} />
                                ))}
                            </div>
                        )}
                     </div>
                )}

                {activeTab === 'downloads' && (
                    <div className="animate-fade-in">
                        {/* Storage Usage Bar */}
                        {storageUsage && (
                            <div className="mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                    <span>Storage Used</span>
                                    <span>{formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${storageUsage.usage / storageUsage.quota > 0.8 ? 'bg-red-500' : 'bg-brand'}`} 
                                        style={{ width: `${Math.min((storageUsage.usage / storageUsage.quota) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* Active Downloads Queue */}
                        {activeDownloadList.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-white mb-4">Downloading...</h3>
                                <div className="space-y-3">
                                    {activeDownloadList.map((item) => (
                                        <div key={item.content.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                            <div className="flex items-center gap-4 mb-2">
                                                 <img src={item.content.thumbnailUrl} className="w-12 h-16 object-cover rounded bg-black" />
                                                 <div className="flex-1">
                                                     <h4 className="text-white font-bold text-sm">{item.content.title}</h4>
                                                     <p className="text-xs text-gray-400">{item.status === 'error' ? 'Failed' : `${item.progress}%`}</p>
                                                 </div>
                                                 <button 
                                                    onClick={() => cancelDownload(item.content.id)}
                                                    className="p-2 text-gray-400 hover:text-white"
                                                    title="Cancel Download"
                                                 >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                                 </button>
                                            </div>
                                            {item.status !== 'error' && (
                                                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                                                </div>
                                            )}
                                            {item.status === 'error' && <p className="text-xs text-red-500 mt-1">{item.error || 'Unknown error'}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Downloaded for Offline</h3>
                            {downloads.length > 0 && (
                                <button onClick={handleClearAllDownloads} className="text-xs text-red-500 hover:text-red-400 font-bold border border-red-500 px-3 py-1 rounded">Delete All</button>
                            )}
                        </div>

                        {downloads.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-gray-500 mb-2">No downloads yet.</p>
                                <p className="text-xs text-gray-600">Download movies on Wi-Fi to watch when you're offline.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {downloads.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 bg-gray-900 p-3 rounded-lg border border-gray-800 hover:border-brand/50 transition cursor-pointer" onClick={() => onPlay(item.content, 0)}>
                                        <div className="w-16 h-24 flex-shrink-0 bg-black rounded overflow-hidden">
                                            <img src={item.content.thumbnailUrl} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white truncate">{item.content.title}</h4>
                                            <p className="text-xs text-gray-400">{item.content.genre} • {Math.floor((item.content.duration || 3600)/60)}m</p>
                                            <p className="text-[10px] text-gray-600 mt-1">Downloaded on {new Date(item.downloadDate).toLocaleDateString()}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteDownload(item.id, e)}
                                            className="p-2 text-gray-500 hover:text-red-500 transition"
                                            title="Delete"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-md mx-auto animate-fade-in">
                        {deferredPrompt && (
                            <div className="bg-brand/10 border border-brand/30 p-4 rounded-lg mb-8 flex items-center justify-between">
                                <div>
                                    <h4 className="text-brand font-bold text-sm">Install App</h4>
                                    <p className="text-gray-400 text-xs">Add Hoyeeh to your home screen</p>
                                </div>
                                <Button onClick={handleInstallApp} className="text-xs py-2">Install</Button>
                            </div>
                        )}

                        <h3 className="text-lg font-bold text-white mb-6">Security Settings</h3>
                        <form onSubmit={handleUpdateSettings} className="space-y-6">
                            <div>
                                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Change PIN</label>
                                <input 
                                    type="password" 
                                    maxLength={4}
                                    placeholder="Enter new 4-digit PIN"
                                    value={newPin}
                                    onChange={e => setNewPin(e.target.value)}
                                    className="w-full bg-black border border-gray-700 p-3 rounded text-white focus:border-brand focus:outline-none"
                                />
                                <p className="text-gray-600 text-xs mt-1">Leave blank to keep current PIN.</p>
                            </div>
                            <div>
                                <label className="block text-gray-400 text-xs uppercase font-bold mb-2">Change Secret Word</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter new secret word"
                                    value={newSecret}
                                    onChange={e => setNewSecret(e.target.value)}
                                    className="w-full bg-black border border-gray-700 p-3 rounded text-white focus:border-brand focus:outline-none"
                                />
                                <p className="text-gray-600 text-xs mt-1">Used for account recovery.</p>
                            </div>
                            <Button type="submit" fullWidth>Update Profile</Button>
                        </form>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="animate-fade-in">
                        <h3 className="text-lg font-bold text-white mb-6">Subscription Details</h3>
                        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-gray-400 text-sm uppercase">Current Plan</p>
                                    <h2 className="text-2xl font-bold text-white mt-1">{user.isSubscribed ? 'Hoyeeh Premium' : 'Free Tier'}</h2>
                                </div>
                                <div className="text-right">
                                     <p className="text-gray-400 text-sm uppercase">Status</p>
                                     <span className={`inline-block mt-1 px-3 py-1 rounded text-xs font-bold ${user.isSubscribed ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                                        {user.isSubscribed ? 'ACTIVE' : 'INACTIVE'}
                                     </span>
                                </div>
                            </div>
                            
                            {user.isSubscribed ? (
                                <div>
                                    <p className="text-gray-400 text-sm mb-4">Your next billing date is <span className="text-white font-bold">Unknown (Demo)</span></p>
                                    <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white" onClick={handleCancelSub}>
                                        Cancel Subscription
                                    </Button>
                                    <p className="text-gray-600 text-xs mt-2">Cancellation will take effect at the end of your billing cycle.</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-gray-400 text-sm mb-4">Unlock the full Hoyeeh experience today.</p>
                                    <Button fullWidth onClick={() => alert("Please go to Home to subscribe!")}>Upgrade to Premium</Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
