/**
 * Game Screen - Core Wordle gameplay
 * Purpose: Handle word guessing, validation, scoring, and level progression
 * How to extend: Add animations, sound effects, multiplayer features
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  Dimensions,
  Vibration
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import { getRandomWord, isValidWord } from '../data/words';

const { width: screenWidth } = Dimensions.get('window');
const GRID_SIZE = 6;
const WORD_LENGTH = 5;

export default function GameScreen() {
  const { 
    currentLevel, 
    coins, 
    startGame, 
    completeGame, 
    useBooster 
  } = useGameStore();

  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState(Array(GRID_SIZE).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentRow, setCurrentRow] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost
  const [usedLetters, setUsedLetters] = useState({});
  const [startTime, setStartTime] = useState(Date.now());
  const [hintLetters, setHintLetters] = useState(new Set());

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, [currentLevel]);

  const initializeGame = () => {
    const word = getRandomWord();
    setTargetWord(word);
    setGuesses(Array(GRID_SIZE).fill(''));
    setCurrentGuess('');
    setCurrentRow(0);
    setGameStatus('playing');
    setUsedLetters({});
    setStartTime(Date.now());
    setHintLetters(new Set());
    startGame(currentLevel);
  };

  const handleKeyPress = (key) => {
    if (gameStatus !== 'playing') return;

    if (key === 'ENTER') {
      handleSubmit();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(prev => prev + key);
    }
  };

  const handleSubmit = () => {
    if (currentGuess.length !== WORD_LENGTH) {
      Alert.alert('Invalid Length', 'Please enter a 5-letter word');
      return;
    }

    if (!isValidWord(currentGuess)) {
      Alert.alert('Invalid Word', 'Not a valid English word');
      return;
    }

    // Update guesses
    const newGuesses = [...guesses];
    newGuesses[currentRow] = currentGuess;
    setGuesses(newGuesses);

    // Update used letters
    const newUsedLetters = { ...usedLetters };
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = currentGuess[i];
      const status = getLetterStatus(letter, i, currentGuess, targetWord);
      if (!newUsedLetters[letter] || status === 'correct') {
        newUsedLetters[letter] = status;
      }
    }
    setUsedLetters(newUsedLetters);

    // Check win condition
    if (currentGuess === targetWord) {
      setGameStatus('won');
      const completionTime = Date.now() - startTime;
      setTimeout(() => {
        completeGame(true, completionTime);
        showWinAlert();
      }, 1000);
    } else if (currentRow === GRID_SIZE - 1) {
      setGameStatus('lost');
      setTimeout(() => {
        completeGame(false, Date.now() - startTime);
        showLoseAlert();
      }, 1000);
    } else {
      setCurrentRow(currentRow + 1);
      setCurrentGuess('');
    }
  };

  const getLetterStatus = (letter, position, guess, target) => {
    if (target[position] === letter) return 'correct';
    if (target.includes(letter)) return 'present';
    return 'absent';
  };

  const showWinAlert = () => {
    const score = Math.max(0, 100 - (currentRow * 10));
    const coinsEarned = score >= 50 ? 20 : 10;
    Alert.alert(
      'Congratulations! 🎉',
      `You won Level ${currentLevel}!\nScore: ${score}\nCoins earned: ${coinsEarned}`,
      [
        { text: 'Next Level', onPress: () => router.replace('/') }
      ]
    );
  };

  const showLoseAlert = () => {
    Alert.alert(
      'Game Over 😔',
      `The word was: ${targetWord}\nTry again or use boosters to help!`,
      [
        { text: 'Try Again', onPress: initializeGame },
        { text: 'Home', onPress: () => router.replace('/') }
      ]
    );
  };

  const handleDartBooster = async () => {
    if (await useBooster('dart', 15)) {
      // Remove up to 3 incorrect letters from keyboard
      const incorrectLetters = Object.keys(usedLetters)
        .filter(letter => usedLetters[letter] === 'absent')
        .slice(0, 3);
      
      const newUsedLetters = { ...usedLetters };
      incorrectLetters.forEach(letter => {
        newUsedLetters[letter] = 'removed';
      });
      setUsedLetters(newUsedLetters);
      
      Alert.alert('Dart Used!', `Removed ${incorrectLetters.length} incorrect letters`);
    } else {
      Alert.alert('Not Enough Coins', 'You need 15 coins to use Dart');
    }
  };

  const handleHintBooster = async () => {
    if (await useBooster('hint', 25)) {
      // Reveal a correct letter position
      const availablePositions = [];
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (!hintLetters.has(i)) {
          availablePositions.push(i);
        }
      }
      
      if (availablePositions.length > 0) {
        const randomPos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        const newHintLetters = new Set(hintLetters);
        newHintLetters.add(randomPos);
        setHintLetters(newHintLetters);
        
        // Update current guess with hint
        const newGuess = currentGuess.split('');
        newGuess[randomPos] = targetWord[randomPos];
        setCurrentGuess(newGuess.join('').slice(0, WORD_LENGTH));
        
        Alert.alert('Hint Used!', `Revealed letter at position ${randomPos + 1}`);
      }
    } else {
      Alert.alert('Not Enough Coins', 'You need 25 coins to use Hint');
    }
  };

  const handleSkipBooster = async () => {
    if (await useBooster('skip', 50)) {
      Alert.alert(
        'Skip Level',
        'Are you sure you want to skip this level?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Skip', 
            onPress: () => {
              completeGame(true, Date.now() - startTime);
              router.replace('/');
            }
          }
        ]
      );
    } else {
      Alert.alert('Not Enough Coins', 'You need 50 coins to use Skip');
    }
  };

  const renderGrid = () => {
    return (
      <View style={styles.grid}>
        {Array(GRID_SIZE).fill(0).map((_, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {Array(WORD_LENGTH).fill(0).map((_, colIndex) => {
              let letter = '';
              let status = 'empty';
              
              if (rowIndex < currentRow) {
                // Completed row
                letter = guesses[rowIndex][colIndex] || '';
                status = getLetterStatus(letter, colIndex, guesses[rowIndex], targetWord);
              } else if (rowIndex === currentRow) {
                // Current row
                letter = currentGuess[colIndex] || '';
                status = hintLetters.has(colIndex) ? 'hint' : 'current';
              }
              
              return (
                <View key={colIndex} style={[styles.cell, styles[status]]}>
                  <Text style={[styles.cellText, styles[`${status}Text`]]}>{letter}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderKeyboard = () => {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
    ];

    return (
      <View style={styles.keyboard}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyboardRow}>
            {row.map((key) => {
              let keyStatus = 'default';
              if (usedLetters[key]) {
                keyStatus = usedLetters[key];
              }
              
              const isSpecialKey = key === 'ENTER' || key === 'BACKSPACE';
              
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    isSpecialKey && styles.specialKey,
                    styles[`key${keyStatus.charAt(0).toUpperCase() + keyStatus.slice(1)}`]
                  ]}
                  onPress={() => handleKeyPress(key)}
                  disabled={keyStatus === 'removed'}
                >
                  <Text style={[
                    styles.keyText,
                    isSpecialKey && styles.specialKeyText,
                    keyStatus === 'removed' && styles.removedKeyText
                  ]}>
                    {key === 'BACKSPACE' ? '⌫' : key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const getSubmitButtonText = () => {
    if (currentGuess.length !== WORD_LENGTH) return 'ENTER';
    if (!isValidWord(currentGuess)) return 'NOT A WORD';
    return 'SUBMIT';
  };

  const getSubmitButtonStyle = () => {
    if (currentGuess.length !== WORD_LENGTH) return styles.submitDisabled;
    if (!isValidWord(currentGuess)) return styles.submitInvalid;
    return styles.submitReady;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.levelText}>Level {currentLevel}</Text>
        <View style={styles.coinsInfo}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.coinsText}>{coins}</Text>
        </View>
      </View>

      {renderGrid()}

      <View style={styles.gameActions}>
        <View style={styles.boosters}>
          <TouchableOpacity 
            style={styles.boosterButton}
            onPress={handleDartBooster}
          >
            <Ionicons name="location" size={20} color="#ff6b35" />
            <Text style={styles.boosterText}>15</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.boosterButton}
            onPress={handleHintBooster}
          >
            <Ionicons name="bulb" size={20} color="#ffd60a" />
            <Text style={styles.boosterText}>25</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.boosterButton}
            onPress={handleSkipBooster}
          >
            <Ionicons name="play-forward" size={20} color="#06d6a0" />
            <Text style={styles.boosterText}>50</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, getSubmitButtonStyle()]}
          onPress={handleSubmit}
          disabled={gameStatus !== 'playing' || currentGuess.length !== WORD_LENGTH}
        >
          <Text style={[styles.submitButtonText, styles.submitButtonTextFixed]}>
            {getSubmitButtonText()}
          </Text>
        </TouchableOpacity>
      </View>

      {renderKeyboard()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  coinsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  grid: {
    alignItems: 'center',
    marginVertical: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  cell: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  cellText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  empty: {
    backgroundColor: 'white',
  },
  current: {
    backgroundColor: 'white',
    borderColor: '#6b7280',
  },
  correct: {
    backgroundColor: '#6aaa64',
    borderColor: '#6aaa64',
  },
  correctText: {
    color: 'white',
  },
  present: {
    backgroundColor: '#c9b458',
    borderColor: '#c9b458',
  },
  presentText: {
    color: 'white',
  },
  absent: {
    backgroundColor: '#787c7e',
    borderColor: '#787c7e',
  },
  absentText: {
    color: 'white',
  },
  hint: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  hintText: {
    color: 'white',
  },
  gameActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  boosters: {
    flexDirection: 'row',
    gap: 8,
  },
  boosterButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 40,
  },
  boosterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: 100, // 固定宽度而不是最小宽度
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 11, // 减小字体以适应固定宽度
  },
  submitButtonTextFixed: {
    fontSize: 11, // 统一字体大小
  },
  submitReady: {
    backgroundColor: '#6aaa64',
  },
  submitDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitInvalid: {
    backgroundColor: '#ef4444',
  },
  keyboard: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  key: {
    backgroundColor: '#d1d5db',
    borderRadius: 4,
    margin: 2,
    minWidth: 32,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  specialKey: {
    minWidth: 48,
    backgroundColor: '#9ca3af',
  },
  keyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  specialKeyText: {
    fontSize: 12,
    color: 'white',
  },
  keyCorrect: {
    backgroundColor: '#6aaa64',
  },
  keyPresent: {
    backgroundColor: '#c9b458',
  },
  keyAbsent: {
    backgroundColor: '#787c7e',
  },
  keyRemoved: {
    backgroundColor: '#f3f4f6',
    opacity: 0.5,
  },
  removedKeyText: {
    color: '#9ca3af',
  },
});