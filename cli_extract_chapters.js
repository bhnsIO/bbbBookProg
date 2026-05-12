const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractChapters(filePath) {
  try {
    const cmd = `ffprobe -v quiet -print_format json -show_chapters -show_format "${filePath}"`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    const data = JSON.parse(output);

    const chapters = data.chapters || [];
    const duration = parseFloat(data.format?.duration || 0);

    const outTxt = [];
    
    if (chapters.length === 0) {
      console.log("No embedded chapters found. Assuming single chapter.");
      const h = Math.floor(duration / 3600);
      const m = Math.floor((duration % 3600) / 60);
      const s = Math.floor(duration % 60);
      outTxt.push(`Chapter 1: ${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    } else {
      chapters.forEach((chap, idx) => {
        const start = parseFloat(chap.start_time);
        const end = parseFloat(chap.end_time);
        const length = end - start;
        
        const h = Math.floor(length / 3600);
        const m = Math.floor((length % 3600) / 60);
        const s = Math.floor(length % 60);
        
        const timeStr = h > 0 
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`;
          
        outTxt.push(`Chapter ${idx + 1}: ${timeStr}`);
      });
    }

    const outFile = filePath.replace(/\.[^/.]+$/, "") + "_chapters.txt";
    fs.writeFileSync(outFile, outTxt.join('\n'), 'utf-8');
    
    console.log(`Successfully extracted ${Math.max(chapters.length, 1)} chapters.`);
    console.log(`Saved to: ${outFile}`);

  } catch (error) {
    console.error("Error running ffprobe. Make sure FFmpeg is installed and accessible in PATH.");
    console.error(error.message);
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node extract_chapters.js <audio_file>");
} else {
  extractChapters(args[0]);
}
