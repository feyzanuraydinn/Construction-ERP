import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUsers, FiFolder, FiPackage, FiX } from 'react-icons/fi';
import type { Company, Project, Material } from '../../types';

interface SearchResult {
  id: number;
  type: 'company' | 'project' | 'material';
  name: string;
  subtitle?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons = {
  company: FiUsers,
  project: FiFolder,
  material: FiPackage,
};

const typeLabels = {
  company: 'Cari',
  project: 'Proje',
  material: 'Malzeme',
};

const typeColors = {
  company: 'text-blue-600 bg-blue-50',
  project: 'text-purple-600 bg-purple-50',
  material: 'text-orange-600 bg-orange-50',
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [companies, projects, materials] = await Promise.all([
        window.electronAPI.company.getAll(),
        window.electronAPI.project.getAll(),
        window.electronAPI.material.getAll(),
      ]);

      const lowerQuery = searchQuery.toLowerCase();
      const searchResults: SearchResult[] = [];

      companies
        .filter((c: Company) => c.name.toLowerCase().includes(lowerQuery))
        .slice(0, 5)
        .forEach((c: Company) => {
          searchResults.push({
            id: c.id,
            type: 'company',
            name: c.name,
            subtitle: c.phone || c.email || undefined,
          });
        });

      projects
        .filter(
          (p: Project) =>
            p.name.toLowerCase().includes(lowerQuery) || p.code.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 5)
        .forEach((p: Project) => {
          searchResults.push({
            id: p.id,
            type: 'project',
            name: p.name,
            subtitle: p.code,
          });
        });

      materials
        .filter(
          (m: Material) =>
            m.name.toLowerCase().includes(lowerQuery) || m.code.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 5)
        .forEach((m: Material) => {
          searchResults.push({
            id: m.id,
            type: 'material',
            name: m.name,
            subtitle: m.code,
          });
        });

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    switch (result.type) {
      case 'company':
        navigate(`/companies/${result.id}`);
        break;
      case 'project':
        navigate(`/projects/${result.id}`);
        break;
      case 'material':
        navigate('/stock');
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div className="flex items-start justify-center min-h-screen pt-24 px-4">
        <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl transform transition-all">
          <div className="flex items-center px-4 border-b border-gray-200">
            <FiSearch className="text-gray-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Cari, proje veya malzeme ara..."
              className="flex-1 px-3 py-4 text-gray-900 placeholder-gray-400 bg-transparent border-0 focus:outline-none focus:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="w-6 h-6 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <ul className="py-2">
                {results.map((result, index) => {
                  const Icon = typeIcons[result.type];
                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className={`p-2 rounded-lg ${typeColors[result.type]}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{result.name}</p>
                          {result.subtitle && (
                            <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">
                          {typeLabels[result.type]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : query ? (
              <div className="px-4 py-8 text-center text-gray-500">Sonuç bulunamadı</div>
            ) : (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                Aramak için yazmaya başlayın
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">↑↓</kbd> gezin
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Enter</kbd> seç
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd> kapat
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
