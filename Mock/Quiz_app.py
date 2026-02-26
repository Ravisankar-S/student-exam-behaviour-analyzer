import streamlit as st
import time
import pandas as pd
import numpy as np
import os

# -----------------------------
# Generate Sequential Attempt ID
# -----------------------------
def generate_attempt_id():
    if os.path.exists("real_quiz_dataset.csv"):
        df = pd.read_csv("real_quiz_dataset.csv")
        count = len(df)
    else:
        count = 0
    return f"A{count:02}"

# -----------------------------
# Questions (10)
# -----------------------------
questions = [
    {"q": "2 + 2 ?", "options": ["1", "2", "3", "4"], "answer": "4"},
    {"q": "5 * 6 ?", "options": ["20", "25", "30", "35"], "answer": "30"},
    {"q": "Capital of Germany?", "options": ["Paris", "Berlin", "Rome", "Madrid"], "answer": "Berlin"},
    {"q": "10 / 2 ?", "options": ["2", "3", "5", "10"], "answer": "5"},
    {"q": "Square root of 16?", "options": ["2", "4", "6", "8"], "answer": "4"},
    {"q": "3^2 ?", "options": ["6", "7", "8", "9"], "answer": "9"},
    {"q": "7 + 8 ?", "options": ["13", "14", "15", "16"], "answer": "15"},
    {"q": "Capital of Italy?", "options": ["Lisbon", "Rome", "Paris", "Berlin"], "answer": "Rome"},
    {"q": "12 - 5 ?", "options": ["5", "6", "7", "8"], "answer": "7"},
    {"q": "8 * 2 ?", "options": ["12", "14", "16", "18"], "answer": "16"}
]

total_questions = len(questions)

# -----------------------------
# Initialize Session State
# -----------------------------
if "attempt_id" not in st.session_state:
    st.session_state.attempt_id = generate_attempt_id()

if "current_q" not in st.session_state:
    st.session_state.current_q = 0

if "start_time" not in st.session_state:
    st.session_state.start_time = time.time()

if "answers" not in st.session_state:
    st.session_state.answers = {}

if "revision_count" not in st.session_state:
    st.session_state.revision_count = 0

if "navigation_count" not in st.session_state:
    st.session_state.navigation_count = 0

# -----------------------------
# UI
# -----------------------------
st.title(" Quiz")

student_name = st.text_input("Enter your Name")

q_index = st.session_state.current_q
question = questions[q_index]

st.subheader(f"Question {q_index + 1} of {total_questions}")

# Show previous answer if exists
previous_answer = st.session_state.answers.get(q_index)

selected_answer = st.radio(
    question["q"],
    question["options"],
    index=question["options"].index(previous_answer) if previous_answer else None,
    key=f"radio_{q_index}"
)

# Track revisions
if selected_answer is not None:
    if q_index in st.session_state.answers:
        if st.session_state.answers[q_index] != selected_answer:
            st.session_state.revision_count += 1
    st.session_state.answers[q_index] = selected_answer

# -----------------------------
# Navigation (Circular)
# -----------------------------
def next_question():
    st.session_state.navigation_count += 1
    st.session_state.current_q = (st.session_state.current_q + 1) % total_questions

def previous_question():
    st.session_state.navigation_count += 1
    st.session_state.current_q = (st.session_state.current_q - 1) % total_questions

col1, col2 = st.columns(2)

with col1:
    st.button("Previous", on_click=previous_question)

with col2:
    st.button("Next", on_click=next_question)

# -----------------------------
# Behavior Classification Rules
# -----------------------------
def assign_behavior(avg_time, revision, navigation, accuracy, unattempted):

    # Fast_Response
    if (
        avg_time < 8 and
        revision <= 1 and
        navigation <= 2 and
        0.4 <= accuracy <= 0.75
    ):
        return "Fast_Response"

    # High_Revision
    elif (
        avg_time > 20 and
        revision >= 4 and
        navigation >= 4
    ):
        return "High_Revision"

    # Disengaged
    elif (
        accuracy < 0.4 or
        unattempted >= 3
    ):
        return "Disengaged"

    # Deliberative
    else:
        return "Deliberative"

# -----------------------------
# Submit
# -----------------------------
if st.button("Submit Quiz"):

    total_time = time.time() - st.session_state.start_time
    avg_time = total_time / total_questions
    time_variance = np.random.uniform(3, 10)

    correct_count = 0
    unattempted_count = 0

    for i, q in enumerate(questions):
        if i in st.session_state.answers:
            if st.session_state.answers[i] == q["answer"]:
                correct_count += 1
        else:
            unattempted_count += 1

    accuracy = correct_count / total_questions

    behavior_label = assign_behavior(
        avg_time,
        st.session_state.revision_count,
        st.session_state.navigation_count,
        accuracy,
        unattempted_count
    )

    final_data = pd.DataFrame([{
        "attempt_id": st.session_state.attempt_id,
        "student_name": student_name,
        "avg_time": round(avg_time, 2),
        "time_variance": round(time_variance, 2),
        "revision_count": st.session_state.revision_count,
        "navigation_count": st.session_state.navigation_count,
        "unattempted_count": unattempted_count,
        "accuracy": round(accuracy, 2),
        "behavior_label": behavior_label
    }])

    if os.path.exists("real_quiz_dataset.csv"):
        final_data.to_csv("real_quiz_dataset.csv", mode="a", header=False, index=False)
    else:
        final_data.to_csv("real_quiz_dataset.csv", index=False)

    st.success("Quiz Submitted Successfully!")
    st.write("Score:", correct_count)
    st.write("Unattempted Questions:", unattempted_count)
    st.write("Behavior Type:", behavior_label)