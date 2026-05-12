import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioSystem;
import java.util.Map;

public class AudiobookCalculator {

    // Supported extensions
    private static final Set<String> EXTENSIONS = new HashSet<>(
        Arrays.asList("mp3", "m4a", "m4b", "wav", "ogg", "flac")
    );

    public static void main(String[] args) {
        File currentDir = new File(".");
        File[] files = currentDir.listFiles();

        if (files == null) {
            System.out.println("No files found.");
            return;
        }

        try (FileWriter writer = new FileWriter("chapter_times.txt")) {

            for (File file : files) {
                if (file.isFile() && isSupported(file.getName())) {
                    long totalSeconds = getDurationInSeconds(file);

                    if (totalSeconds >= 0) {
                        String formattedTime = formatDuration(totalSeconds);

                        // Uses full file name instead of Chapter 1, Chapter 2, etc.
                        String line = file.getName() + ": " + formattedTime + "\n";

                        writer.write(line);
                        System.out.print(line);
                    } else {
                        writer.write(file.getName() + ": Duration unknown\n");
                    }
                }
            }

            System.out.println("Results saved to chapter_times.txt");

        } catch (IOException e) {
            System.err.println("Error writing to file: " + e.getMessage());
        }
    }

    private static boolean isSupported(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        if (lastDot == -1) return false;

        String ext = fileName.substring(lastDot + 1).toLowerCase();
        return EXTENSIONS.contains(ext);
    }

    private static long getDurationInSeconds(File file) {
        try {
            AudioFileFormat fileFormat = AudioSystem.getAudioFileFormat(file);
            Map<String, Object> properties = fileFormat.properties();

            // Preferred method using actual duration metadata
            if (properties.containsKey("duration")) {
                long microseconds = (Long) properties.get("duration");
                return Math.round(microseconds / 1_000_000.0);
            }

            // Fallback using frame calculation
            long frames = fileFormat.getFrameLength();
            float rate = fileFormat.getFormat().getFrameRate();

            if (frames > 0 && rate > 0) {
                return Math.round(frames / rate);
            }

        } catch (Exception e) {
            return approximateSeconds(file);
        }

        return -1;
    }

    private static long approximateSeconds(File file) {
        // Rough estimate using 64 kbps audiobook bitrate
        long fileSizeInBytes = file.length();
        double bits = fileSizeInBytes * 8.0;
        return Math.round(bits / 64000.0);
    }

    private static String formatDuration(long totalSeconds) {
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        if (hours > 0) {
            return String.format("%d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format("%d:%02d", minutes, seconds);
        }
    }
}