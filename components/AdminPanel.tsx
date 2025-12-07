
import React, { useState, useEffect } from 'react';
import { User, Content } from '../types';
import { api } from '../services/api';
import { tmdb } from '../services/tmdb';
import { Button } from './Button';

interface AdminPanelProps {
  onBack: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type Tab = 'users' | 'content';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack, showToast }) => {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  
  return (
    <div className="min-h-screen bg-black pt-20 px-4 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            </button>
            <h1 className="text-3xl font-bold text-brand">Admin Panel</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-4 font-medium transition ${activeTab === 'users' ? 'text-brand border-b-2 border-brand' : 'text-gray-400 hover:text-white'}`}
          >
            User Management
          </button>
          <button 
            onClick={() => setActiveTab('content')}
            className={`pb-4 px-4 font-medium transition ${activeTab === 'content' ? 'text-brand border-b-2 border-brand' : 'text-gray-400 hover:text-white'}`}
          >
            Content Library
          </button>
        </div>

        {activeTab === 'users' ? <UserManagement showToast={showToast} /> : <ContentManagement showToast={showToast} />}
      </div>
    </div>
  );
};

// --- Sub-Components ---

const UserManagement: React.FC<{showToast: any}> = ({ showToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'pin' | 'secret' | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getUsers();
      setUsers(data);
    } catch (err) {
      showToast("Failed to load users", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSub = async (userId: string) => {
    if (!window.confirm("Change subscription status?")) return;
    try {
      await api.admin.toggleSubscription(userId);
      loadUsers(); 
      showToast("Subscription status updated", 'success');
    } catch (err) {
      showToast("Action failed", 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
      if(!window.confirm("Are you sure you want to permanently DELETE this user?")) return;
      try {
          await api.admin.deleteUser(userId);
          setUsers(users.filter(u => u.id !== userId));
          showToast("User deleted successfully", 'success');
      } catch (err) {
          showToast("Failed to delete user", 'error');
      }
  };

  const handleAction = async (userId: string) => {
    if (editMode === 'pin') {
        if (inputValue.length !== 4) return showToast("PIN must be 4 digits", 'error');
        try {
            await api.admin.resetUserPin(userId, inputValue);
            showToast("PIN reset successfully.", 'success');
        } catch (err) { showToast("Failed to reset PIN", 'error'); }
    } else if (editMode === 'secret') {
        if (inputValue.length < 3) return showToast("Secret word too short", 'error');
        try {
            await api.admin.resetUserSecret(userId, inputValue);
            showToast("Secret Word reset successfully.", 'success');
        } catch (err) { showToast("Failed to reset Secret Word", 'error'); }
    }
    
    setEditingUser(null);
    setEditMode(null);
    setInputValue('');
  };

  const filteredUsers = users.filter(u => u.mobileNumber.includes(searchTerm));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <input 
          type="text" 
          placeholder="Search mobile number..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-dark-card border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-brand focus:outline-none w-full max-w-sm"
        />
        <Button variant="outline" onClick={loadUsers} className="ml-4">Refresh</Button>
      </div>

      <div className="bg-dark-card rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900 text-gray-200 uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Subscribed</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                 <tr><td colSpan={5} className="px-6 py-8 text-center">Loading...</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-medium text-white">{user.mobileNumber}</td>
                  <td className="px-6 py-4">{user.role}</td>
                  <td className="px-6 py-4">{user.country}</td>
                  <td className="px-6 py-4">
                    {user.isSubscribed ? <span className="text-green-400">Yes</span> : <span className="text-red-400">No</span>}
                  </td>
                  <td className="px-6 py-4">
                    {editingUser === user.id ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs uppercase font-bold text-gray-500">{editMode}:</span>
                        <input 
                            value={inputValue} 
                            onChange={e => setInputValue(e.target.value)} 
                            maxLength={editMode === 'pin' ? 4 : 20} 
                            placeholder={editMode === 'pin' ? '1234' : 'Secret'}
                            className="w-24 bg-black border border-gray-600 rounded px-1 text-white" 
                        />
                        <button onClick={() => handleAction(user.id)} className="text-green-500 font-bold">OK</button>
                        <button onClick={() => { setEditingUser(null); setEditMode(null); }} className="text-gray-500">X</button>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => { setEditingUser(user.id); setEditMode('pin'); setInputValue(''); }} className="text-brand hover:underline">Reset PIN</button>
                        <button onClick={() => { setEditingUser(user.id); setEditMode('secret'); setInputValue(''); }} className="text-brand hover:underline">Reset Secret</button>
                        <button onClick={() => handleToggleSub(user.id)} className="text-white hover:underline">Toggle Sub</button>
                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-400 font-bold ml-2">DELETE</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ContentManagement: React.FC<{showToast: any}> = ({ showToast }) => {
  const [content, setContent] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [transcodingId, setTranscodingId] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  // Form State
  const initialFormState: Partial<Content> = {
    title: '',
    description: '',
    genre: 'Drama',
    contentType: 'movie',
    videoUrl: '', // Will be replaced by key after upload
    thumbnailUrl: 'https://via.placeholder.com/600x900?text=No+Cover',
    isPremium: true,
    duration: 3600
  };
  const [formData, setFormData] = useState<Partial<Content>>(initialFormState);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    try {
        const data = await api.content.getAll();
        setContent(data);
    } catch (e) {
        showToast("Failed to load content", 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleEditClick = (item: any) => {
      setFormData({
          title: item.title,
          description: item.description,
          genre: item.genre,
          contentType: item.contentType,
          videoUrl: item.videoUrl,
          thumbnailUrl: item.thumbnailUrl,
          isPremium: item.isPremium,
          duration: item.duration || 3600
      });
      setEditId(item.id);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTmdbSearch = async () => {
    if (!formData.title) return showToast("Enter a title to search", 'info');
    showToast(`Searching TMDB for ${formData.contentType === 'movie' ? 'Movie' : 'TV Show'}...`, 'info');
    
    let result;
    if (formData.contentType === 'series') {
        result = await tmdb.searchTv(formData.title);
    } else {
        result = await tmdb.searchMovie(formData.title);
    }
    
    if (result) {
      setFormData(prev => ({
        ...prev,
        title: result.title,
        description: result.description,
        thumbnailUrl: result.thumbnailUrl || prev.thumbnailUrl,
        // If we had a release date field in Content type we would use movie.releaseDate
      }));
      showToast("Found and auto-filled!", 'success');
    } else {
      showToast("Content not found on TMDB", 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return showToast("Please fill title and description", 'error');
    if (!editId && !videoFile && !formData.videoUrl) return showToast("Please upload a video or provide a URL", 'error');
    
    setUploading(true);
    setUploadProgress(0);

    try {
      let videoKey = formData.videoUrl;

      // Handle File Upload to DigitalOcean Spaces
      if (videoFile) {
        // 1. Get Presigned URL
        const { url, key } = await api.admin.getUploadUrl(videoFile.name, videoFile.type);
        videoKey = key;
        
        // 2. Upload File directly to Spaces with Progress
        await api.admin.uploadFileToSpaces(url, videoFile, (percent) => {
          setUploadProgress(percent);
        });
      }

      if (editId) {
          // Edit existing
          await api.admin.updateContent(editId, {
              ...formData,
              videoUrl: videoKey!
          });
          showToast("Content Updated Successfully!", 'success');
      } else {
          // Create new
          await api.admin.addContent({
            ...formData,
            videoUrl: videoKey!
          } as Content);
          showToast("Content Added Successfully!", 'success');
      }

      setShowForm(false);
      setFormData(initialFormState);
      setEditId(null);
      setVideoFile(null);
      loadContent();
    } catch (err: any) {
      showToast("Error saving content: " + err.message, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this content?")) return;
    try {
        await api.admin.deleteContent(id);
        showToast("Content deleted", 'info');
        loadContent();
    } catch(e) { showToast("Delete failed", 'error'); }
  };

  const handleTranscode = async (id: string) => {
    if (!window.confirm("Start transcoding? This may take several minutes.")) return;
    setTranscodingId(id);
    showToast("Transcoding started in background...", 'info');
    try {
        await api.admin.transcodeVideo(id);
        showToast("Transcoding Complete!", 'success');
        loadContent();
    } catch (err: any) {
        showToast("Transcoding Failed: " + err.message, 'error');
    } finally {
        setTranscodingId(null);
    }
  };

  const filteredContent = content.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.genre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Library ({content.length})</h2>
            <input 
                type="text" 
                placeholder="Search titles, genres..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-dark-card border border-gray-700 rounded-lg px-3 py-1 text-sm text-white focus:border-brand focus:outline-none w-64"
            />
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); setFormData(initialFormState); }}>
          {showForm ? 'Cancel' : '+ Add Content'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-4">{editId ? 'Edit Content' : 'Add New Content'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Type</label>
                <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="contentType" className="accent-brand" 
                            checked={formData.contentType === 'movie'} 
                            onChange={() => setFormData({...formData, contentType: 'movie'})} />
                        <span className="text-white text-sm">Movie</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="contentType" className="accent-brand" 
                            checked={formData.contentType === 'series'} 
                            onChange={() => setFormData({...formData, contentType: 'series'})} />
                        <span className="text-white text-sm">TV Show</span>
                    </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Title</label>
                <div className="flex gap-2">
                  <input required className="w-full bg-black border border-gray-700 p-2 rounded text-white" 
                    value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  <button type="button" onClick={handleTmdbSearch} className="bg-blue-600 text-white px-3 rounded text-xs whitespace-nowrap hover:bg-blue-700">
                    Auto-Fill TMDB
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Description</label>
                <textarea required className="w-full bg-black border border-gray-700 p-2 rounded text-white h-24" 
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Genre</label>
                <select className="w-full bg-black border border-gray-700 p-2 rounded text-white"
                  value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})}>
                  <option>Drama</option>
                  <option>Action</option>
                  <option>Comedy</option>
                  <option>Documentary</option>
                  <option>Horror</option>
                  <option>Thriller</option>
                  <option>Romance</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Thumbnail URL</label>
                <input required className="w-full bg-black border border-gray-700 p-2 rounded text-white" 
                  value={formData.thumbnailUrl} onChange={e => setFormData({...formData, thumbnailUrl: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold">Video File (DO Spaces)</label>
                <div className="bg-black border border-gray-700 p-2 rounded">
                  <input type="file" accept="video/*" className="text-white text-sm w-full" 
                    onChange={handleFileChange} />
                </div>
                {uploading && (
                    <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Uploading...</span>
                            <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div className="bg-brand h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    </div>
                )}
              </div>
               <div>
                 <span className="text-xs text-gray-500 uppercase font-bold">OR</span>
                 <label className="block text-xs text-gray-400 uppercase font-bold mt-2">External Video URL</label>
                 <input className="w-full bg-black border border-gray-700 p-2 rounded text-white" 
                  placeholder="https://..."
                  value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} />
               </div>
              <div className="flex items-center gap-3 pt-4">
                 <input type="checkbox" id="premium" className="w-5 h-5 accent-brand"
                  checked={formData.isPremium} onChange={e => setFormData({...formData, isPremium: e.target.checked})} />
                 <label htmlFor="premium" className="text-white font-medium">Premium Content (Requires Subscription)</label>
              </div>
              <div className="pt-2">
                <Button type="submit" fullWidth disabled={uploading}>
                  {uploading ? 'Uploading...' : editId ? 'Update Content' : 'Save to Library'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <p className="text-gray-500">Loading library...</p> : filteredContent.map(item => (
          <div key={item.id} className="group relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
            <div className="aspect-[2/3] w-full relative">
              <img src={item.thumbnailUrl} className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-white/20">
                {item.contentType}
              </div>
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-4">
                {transcodingId === item.id ? (
                   <div className="text-white text-xs animate-pulse text-center">Transcoding...</div>
                ) : (
                  <>
                     <button onClick={() => handleEditClick(item)} className="bg-white text-black px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-200 w-full">Edit</button>
                     {!item.isTranscoded && (
                         <button onClick={() => handleTranscode(item.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 w-full">Transcode</button>
                     )}
                     <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 w-full">Delete</button>
                  </>
                )}
              </div>
            </div>
            <div className="p-3">
              <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
              <div className="flex justify-between items-center mt-1">
                 <p className="text-xs text-gray-500">{item.genre}</p>
                 {item.isTranscoded && <span className="text-[10px] text-green-500 font-bold border border-green-500 px-1 rounded">HLS</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
