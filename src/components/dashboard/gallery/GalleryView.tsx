import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  Lock,
  Globe,
  X,
} from "lucide-react";

interface Photo {
  id: string;
  url: string;
  alt: string;
}

interface Album {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  photos: Photo[];
}

const mockAlbums: Album[] = [
  {
    id: "1",
    title: "제주도 여행",
    description: "2025년 가을 제주도 여행 기록",
    isPublic: true,
    photos: [
      { id: "p1", url: "https://picsum.photos/seed/jeju1/400/400", alt: "제주 1" },
      { id: "p2", url: "https://picsum.photos/seed/jeju2/400/400", alt: "제주 2" },
      { id: "p3", url: "https://picsum.photos/seed/jeju3/400/400", alt: "제주 3" },
      { id: "p4", url: "https://picsum.photos/seed/jeju4/400/400", alt: "제주 4" },
      { id: "p5", url: "https://picsum.photos/seed/jeju5/400/400", alt: "제주 5" },
      { id: "p6", url: "https://picsum.photos/seed/jeju6/400/400", alt: "제주 6" },
    ],
  },
  {
    id: "2",
    title: "일상",
    description: "소중한 일상 순간들",
    isPublic: false,
    photos: [
      { id: "p7", url: "https://picsum.photos/seed/daily1/400/400", alt: "일상 1" },
      { id: "p8", url: "https://picsum.photos/seed/daily2/400/400", alt: "일상 2" },
      { id: "p9", url: "https://picsum.photos/seed/daily3/400/400", alt: "일상 3" },
      { id: "p10", url: "https://picsum.photos/seed/daily4/400/400", alt: "일상 4" },
    ],
  },
  {
    id: "3",
    title: "맛집 탐방",
    description: "함께 방문한 맛집들",
    isPublic: true,
    photos: [
      { id: "p11", url: "https://picsum.photos/seed/food1/400/400", alt: "음식 1" },
      { id: "p12", url: "https://picsum.photos/seed/food2/400/400", alt: "음식 2" },
      { id: "p13", url: "https://picsum.photos/seed/food3/400/400", alt: "음식 3" },
    ],
  },
];

const GalleryView = () => {
  const [albums, setAlbums] = useState<Album[]>(mockAlbums);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [hoveredPhoto, setHoveredPhoto] = useState<string | null>(null);

  const createAlbum = () => {
    if (!newTitle.trim()) return;
    const newAlbum: Album = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      description: newDescription.trim(),
      isPublic: true,
      photos: [],
    };
    setAlbums([...albums, newAlbum]);
    setNewTitle("");
    setNewDescription("");
    setShowCreateForm(false);
  };

  const toggleAlbumVisibility = (albumId: string) => {
    setAlbums(
      albums.map((a) =>
        a.id === albumId ? { ...a, isPublic: !a.isPublic } : a
      )
    );
    if (selectedAlbum?.id === albumId) {
      setSelectedAlbum((prev) =>
        prev ? { ...prev, isPublic: !prev.isPublic } : null
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedAlbum && (
            <button
              onClick={() => setSelectedAlbum(null)}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl sm:text-2xl font-bold truncate">
            {selectedAlbum ? selectedAlbum.title : "갤러리"}
          </h2>
        </div>
        {!selectedAlbum && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span>새 앨범</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showCreateForm && !selectedAlbum && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl p-5 space-y-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-muted-foreground">앨범 만들기</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <input
              type="text"
              placeholder="앨범 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
            <input
              type="text"
              placeholder="앨범 설명 (선택)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
            <button
              onClick={createAlbum}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              만들기
            </button>
          </motion.div>
        )}

        {!selectedAlbum && (
          <motion.div
            key="album-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {albums.map((album, index) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="bg-card rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium">{album.title}</h3>
                    {album.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {album.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlbumVisibility(album.id)}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                      title={album.isPublic ? "공개" : "비공개"}
                    >
                      {album.isPublic ? (
                        <Globe className="h-4 w-4 text-primary" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                      {album.photos.length}장
                    </span>
                  </div>
                </div>
                {album.photos.length > 0 ? (
                  <button
                    onClick={() => setSelectedAlbum(album)}
                    className="w-full grid grid-cols-3 gap-1.5 rounded-lg overflow-hidden"
                  >
                    {album.photos.slice(0, 3).map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square bg-muted rounded-md overflow-hidden"
                      >
                        <img
                          src={photo.url}
                          alt={photo.alt}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </button>
                ) : (
                  <div className="flex items-center justify-center h-24 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">사진이 없습니다</p>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {selectedAlbum && (
          <motion.div
            key="album-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              {selectedAlbum.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedAlbum.description}
                </p>
              )}
              <button
                onClick={() => toggleAlbumVisibility(selectedAlbum.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs transition-colors hover:bg-muted/80"
              >
                {selectedAlbum.isPublic ? (
                  <>
                    <Globe className="h-3 w-3" /> 공개
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> 비공개
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {selectedAlbum.photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="aspect-square bg-muted rounded-lg overflow-hidden relative cursor-pointer"
                  onMouseEnter={() => setHoveredPhoto(photo.id)}
                  onMouseLeave={() => setHoveredPhoto(null)}
                >
                  <img
                    src={photo.url}
                    alt={photo.alt}
                    className={`w-full h-full object-cover transition-transform duration-500 ${
                      hoveredPhoto === photo.id ? "scale-110" : "scale-100"
                    }`}
                    loading="lazy"
                  />
                </motion.div>
              ))}
            </div>

            {selectedAlbum.photos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <ImageIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">아직 사진이 없습니다</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GalleryView;
