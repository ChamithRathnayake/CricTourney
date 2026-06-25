import React, { useState } from 'react';
import { pb, type News } from '../services/pocketbase';
import { Calendar, Download, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react';

interface NewsViewProps {
  newsList: News[];
}

export const NewsView: React.FC<NewsViewProps> = ({ newsList }) => {
  const getImageUrl = (newsId: string, filename: string) => {
    return `${pb.baseUrl}/api/files/news/${newsId}/${filename}`;
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const localUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(localUrl);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  // Slideshow Component for individual news cards
  const NewsSlideshow: React.FC<{ newsItem: News }> = ({ newsItem }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [startX, setStartX] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const photos = newsItem.photos || [];

    if (photos.length === 0) return null;

    if (photos.length === 1) {
      const imgUrl = getImageUrl(newsItem.id, photos[0]);
      return (
        <div className="relative w-full h-[300px] md:h-[450px] bg-slate-950/60 rounded-2xl overflow-hidden border border-slate-900 flex items-center justify-center group select-none">
          <img
            src={imgUrl}
            alt="News image"
            draggable="false"
            className="w-full h-full object-cover select-none"
          />
          {/* Download button */}
          <button
            onClick={() => handleDownload(imgUrl, `news_${newsItem.id}_0.png`)}
            className="absolute top-4 right-4 p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl cursor-pointer shadow-lg backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            <span>Download Image</span>
          </button>
        </div>
      );
    }

    const currentImgUrl = getImageUrl(newsItem.id, photos[currentIndex]);

    const prevSlide = () => {
      setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    };

    const nextSlide = () => {
      setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    };

    const handleStart = (clientX: number) => {
      setStartX(clientX);
      setIsDragging(true);
    };

    const handleEnd = (clientX: number) => {
      if (!isDragging || startX === null) return;
      const diffX = startX - clientX;
      if (Math.abs(diffX) > 40) { // 40px threshold for swipes/drags
        if (diffX > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      setIsDragging(false);
      setStartX(null);
    };

    const onMouseDown = (e: React.MouseEvent) => {
      handleStart(e.clientX);
    };

    const onMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || startX === null) return;
      e.preventDefault();
    };

    const onMouseUp = (e: React.MouseEvent) => {
      handleEnd(e.clientX);
    };

    const onMouseLeave = () => {
      setIsDragging(false);
      setStartX(null);
    };

    const onTouchStart = (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientX);
    };

    const onTouchEnd = (e: React.TouchEvent) => {
      if (e.changedTouches.length > 0) {
        handleEnd(e.changedTouches[0].clientX);
      }
    };

    return (
      <div
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative w-full h-[300px] md:h-[450px] bg-slate-950/60 rounded-2xl overflow-hidden border border-slate-900 flex items-center justify-center group cursor-grab active:cursor-grabbing select-none"
      >
        <img
          src={currentImgUrl}
          alt={`News image ${currentIndex + 1}`}
          draggable="false"
          className="w-full h-full object-cover transition-all duration-500 select-none"
        />

        {/* Navigation arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); prevSlide(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl cursor-pointer shadow-lg backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); nextSlide(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl cursor-pointer shadow-lg backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Download button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(currentImgUrl, `news_${newsItem.id}_${currentIndex}.png`); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 rounded-xl cursor-pointer shadow-lg backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider z-10"
        >
          <Download className="w-4 h-4" />
          <span>Download Image</span>
        </button>

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-slate-950/50 px-3 py-1.5 rounded-full backdrop-blur-sm z-10">
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${currentIndex === idx ? 'bg-emerald-455 w-4' : 'bg-slate-650 hover:bg-slate-550'
                }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const formatNewsTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-lg shadow-emerald-500/5">
          <Newspaper className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent uppercase tracking-tight m-0">News & Gallery</h2>
          <p className="text-xs text-slate-400 mt-1">Get the latest highlights, department schedules, and tournament photos.</p>
        </div>
      </div>

      {newsList.length === 0 ? (
        <div className="glass-panel p-16 text-center border border-slate-800/80 rounded-3xl bg-slate-900/10">
          <Newspaper className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-450 uppercase tracking-wider">No News Posted Yet</h3>
          <p className="text-xs text-slate-550 max-w-xs mx-auto mt-2 leading-relaxed">Check back later for match announcements, gallery pictures, and highlights.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {newsList.map((item) => (
            <article
              key={item.id}
              className="glass-panel rounded-3xl border border-slate-800/80 p-6 sm:p-8 space-y-5 bg-gradient-to-b from-slate-900/40 via-slate-950/20 to-slate-900/40 shadow-2xl hover:border-slate-800 transition-all duration-300 w-full"
            >
              {/* Photo Slideshow or Single Photo */}
              <NewsSlideshow newsItem={item} />

              {/* Text Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatNewsTime(item.created)}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-100 tracking-tight leading-tight uppercase hover:text-emerald-400 transition-colors">
                  {item.headline}
                </h3>
                <p className="text-sm text-slate-350 leading-relaxed whitespace-pre-wrap font-medium">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
