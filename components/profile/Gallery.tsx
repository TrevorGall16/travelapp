// components/profile/Gallery.tsx
// Tactile swipeable photo gallery with spring animations and haptic feedback.

import { useCallback, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Colors, Radius } from '../../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GALLERY_PADDING = 40; // 20px each side
const IMAGE_WIDTH = SCREEN_WIDTH - GALLERY_PADDING;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.75;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 100,
  mass: 0.8,
};

interface GalleryProps {
  photos: string[];
}

export default function Gallery({ photos }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const translateX = useSharedValue(0);

  const fireHaptic = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  const updateIndex = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onEnd((e) => {
      const velocity = e.velocityX;
      const swipeThreshold = IMAGE_WIDTH * 0.3;

      let newIndex = activeIndex;

      if (e.translationX < -swipeThreshold || velocity < -500) {
        newIndex = Math.min(activeIndex + 1, photos.length - 1);
      } else if (e.translationX > swipeThreshold || velocity > 500) {
        newIndex = Math.max(activeIndex - 1, 0);
      }

      if (newIndex !== activeIndex) {
        runOnJS(fireHaptic)();
        runOnJS(updateIndex)(newIndex);
      }

      translateX.value = withSpring(-newIndex * IMAGE_WIDTH, SPRING_CONFIG);
    })
    .onUpdate((e) => {
      translateX.value = -activeIndex * IMAGE_WIDTH + e.translationX;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (photos.length === 0) return null;

  return (
    <GestureHandlerRootView>
      <View style={galleryStyles.container}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[galleryStyles.track, animatedStyle]}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={galleryStyles.slide}>
                <Image
                  source={{ uri }}
                  style={galleryStyles.image}
                  contentFit="cover"
                />
              </View>
            ))}
          </Animated.View>
        </GestureDetector>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <View style={galleryStyles.dots}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  galleryStyles.dot,
                  i === activeIndex && galleryStyles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const galleryStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: Radius.md,
  },
  track: {
    flexDirection: 'row',
  },
  slide: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 20,
  },
});
