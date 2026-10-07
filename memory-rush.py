import random
import time
import os


def level_one():
    level_one_numbers = [1, 2, 3, 4, 5]
    first = random.sample(level_one_numbers, 4)
    print(first)
    time.sleep(3)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ")
    task1 = entered_sequence.split()
    converted_integers = []
    for number in task1:
        converted_integers.append(int(number))
    if first == converted_integers:
        print("Excellent")
        return True
    else:
        print("You failed")
        return False


def level_two():
    level_two_numbers = [3, 2, 0, 0, 9, 4]
    second = random.sample(level_two_numbers, 5)
    print(second)
    time.sleep(4)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ")
    task2 = entered_sequence.split()
    converted_integers = []
    for number in task2:
        converted_integers.append(int(number))
    if second == converted_integers:
        print("Excellent")
        return True
    else:
        print("You failed")
        return False


def level_three():
    level_three_numbers = [1, 1, 3, 2, 6, 4]
    third = random.sample(level_three_numbers, 5)
    print(third)
    time.sleep(4)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ")
    task3 = entered_sequence.split()
    converted_integers = []
    for number in task3:
        converted_integers.append(int(number))
    if third == converted_integers:
        print("Excellent")
        return True
    else:
        print("You failed")
        return False  # FIXED: now indented under else


def level_four():
    level_four_numbers = [9, 5, 6, 3, 7, 8]
    fourth = random.sample(level_four_numbers, 6)
    print(fourth)
    time.sleep(4)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ")
    task4 = entered_sequence.split()
    converted_integers = []
    for number in task4:
        converted_integers.append(int(number))
    if fourth == converted_integers:
        print("Excellent")
        return True
    else:
        print("You failed")
        return False


def level_five():
    level_five_numbers = [2, 5, 1, 6, 0]
    fifth = random.sample(level_five_numbers, 5)
    print(fifth)
    time.sleep(3)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ")
    task5 = entered_sequence.split()
    converted_integers = []
    for number in task5:
        converted_integers.append(int(number))
    if fifth == converted_integers:
        print("Excellent")
        return True
    else:
        print("You failed")
        return False


def level_six():
    level_six_items = ["a", 1, 4, "b", "c", 9, 3]
    sixth = random.sample(level_six_items, 7)
    print(sixth)
    time.sleep(5)
    os.system("clear")
    entered_sequence = input("Enter the sequence: ").lower()
    task6 = entered_sequence.split()
    alpha_num = []
    for x in task6:
        try:
            alpha_num.append(int(x))
        except ValueError:
            alpha_num.append(x)
    if sixth == alpha_num:
        print("YOU'RE ON FIRE")
        return True
    else:
        print("I KNEW YOU DON'T HAVE THE BALLS TO PASS THIS LEVEL")
        return False


def level_seven():
    level_seven_letters = ["t", "e", "m", "p", "l", "e"]
    seventh = random.sample(level_seven_letters, 6)
    print(seventh)
    time.sleep(4)
    os.system("clear")
    entered_alphas = input("Enter Alphas: ").lower()
    tasks7 = entered_alphas.split()
    if seventh == tasks7:
        print("YOU'RE GOOD")
        return True
    else:
        print("YOU FLOPPED")
        return False


def level_eight():
    level_eight_letters = ["k", "e", "r", "n", "e", "l"]
    eighth = random.sample(level_eight_letters, 6)
    print(eighth)
    time.sleep(4)
    os.system("clear")
    entered_alphas = input("Enter Alphas: ").lower()
    task8 = entered_alphas.split()
    if eighth == task8:
        print("WONDERFUL")
        return True
    else:
        print("FAILED, YOU'RE A BABY LOL")
        return False


def level_nine():
    level_nine_letters = ["s", "u", "m", "m", "e", "r"]
    ninth = random.sample(level_nine_letters, 6)
    print(ninth)
    time.sleep(4)
    os.system("clear")
    entered_alphas = input("Enter Alphas: ").lower()
    task9 = entered_alphas.split()
    if ninth == task9:
        print("ONE MORE STEP TO GO")
        return True
    else:
        print("WRONG, WE'RE ALMOST THERE")
        return False


def level_ten():
    level_ten_letters = ["n", "e", "u", "r", "o", "g", "e", "n"]
    tenth = random.sample(level_ten_letters, 8)
    print(tenth)
    time.sleep(5)
    os.system("clear")
    entered_alphas = input("Enter Alphas: ").lower()
    task10 = entered_alphas.split()
    if tenth == task10:
        print("YOUR IQ LEVEL IS GOOD FOR ANY SKILL, YOU ARE AMAZING")
        return True
    else:
        print("CAN'T BELIEVE YOU FAILED THIS")
        return False

while True:
    result = level_one()
    if result:
        result = level_two()
    if result:
        result = level_three()
    if result:
        result = level_four()
    if result:
        result = level_five()
    if result:
        result = level_six()
    if result:
        result = level_seven()
    if result:
        result = level_eight()
    if result:
        result = level_nine()
    if result:
        result = level_ten()
    if result:
        print("YOU BEAT MEMORY RUSH")
    user_reply = input("Do you want to play again? YES or NO: ").lower() 
    if user_reply == "no":
        print("GAME ENDED")
        break
   