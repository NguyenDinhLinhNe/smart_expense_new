import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
from models.models import Transaction, Category, User, Budget
import json
class AIService:
    def __init__(self):
        self.scaler = StandardScaler()
        
    def get_user_transactions_data(self, user_id):
        """Prepare transaction data for analysis"""
        transactions = Transaction.query.filter_by(user_id=user_id).order_by(Transaction.date).all()
        
        data = []
        for t in transactions:
            data.append({
                'date': t.date,
                'amount': float(t.amount),
                'type': t.type,
                'category_id': t.category_id,
                'month': t.date.month,
                'year': t.date.year,
                'day_of_week': t.date.weekday()
            })
        
        return pd.DataFrame(data)
    
    def predict_next_month_expense(self, user_id):
        """Predict expense for next month using machine learning"""
        df = self.get_user_transactions_data(user_id)
        
        if df.empty:
            return None
        
        # Filter only expenses
        expense_df = df[df['type'] == 'expense']
        
        if expense_df.empty:
            return {
                'predicted_expense': 0.0,
                'confidence': 'low',
                'method': 'average',
                'top_category': None,
                'top_category_amount': 0.0
            }
        
        # Aggregate by month
        monthly_expense = expense_df.groupby(['year', 'month'])['amount'].sum().reset_index()
        
        # Get top spending category
        category_spending = expense_df.groupby('category_id')['amount'].sum().sort_values(ascending=False)
        top_category_id = category_spending.index[0] if not category_spending.empty else None
        
        top_category = None
        top_category_amount = 0.0
        
        if top_category_id:
            category = Category.query.get(int(top_category_id))
            if category:
                top_category = category.name
                top_category_amount = float(category_spending.iloc[0])
        
        if len(monthly_expense) < 3:
            # Not enough data, use simple average
            avg_expense = expense_df['amount'].mean()
            return {
                'predicted_expense': float(avg_expense) if pd.notna(avg_expense) else 0.0,
                'confidence': 'low',
                'method': 'average',
                'top_category': top_category,
                'top_category_amount': top_category_amount
            }
        
        # Create features for prediction
        monthly_expense['month_num'] = monthly_expense['year'] * 12 + monthly_expense['month']
        X = monthly_expense[['month_num']].values
        y = monthly_expense['amount'].values
        
        # Train Linear Regression model
        model = LinearRegression()
        model.fit(X, y)
        
        # Predict next month
        last_month = monthly_expense.iloc[-1]
        next_month_num = last_month['month_num'] + 1
        prediction = model.predict([[next_month_num]])[0]
        
        return {
            'predicted_expense': max(0.0, float(prediction)) if pd.notna(prediction) else 0.0,
            'confidence': 'medium' if len(monthly_expense) >= 6 else 'low',
            'method': 'linear_regression',
            'top_category': top_category,
            'top_category_amount': top_category_amount
        }
    
    def analyze_spending_patterns(self, user_id):
        """Analyze spending patterns and provide recommendations"""
        df = self.get_user_transactions_data(user_id)
        
        current_date = datetime.now()
        current_month = current_date.month
        current_year = current_date.year
        
        recommendations = []
        
        if df.empty:
            recommendations.append({
                'message': "Welcome! Start logging your transactions and set category budgets. Our AI will analyze your cash flow to save you up to 15% of your income.",
                'potential_savings': 0.0
            })
            return recommendations

        expense_df = df[df['type'] == 'expense']
        income_df = df[df['type'] == 'income']
        
        current_expense_df = expense_df[(expense_df['month'] == current_month) & (expense_df['year'] == current_year)]
        current_income_df = income_df[(income_df['month'] == current_month) & (income_df['year'] == current_year)]
        
        total_income_current = float(current_income_df['amount'].sum()) if not current_income_df.empty else 0.0
        total_expense_current = float(current_expense_df['amount'].sum()) if not current_expense_df.empty else 0.0
        
        # ----------------------------------------------------
        # Rule 1: Category Budget Overruns (Proactive Warnings)
        # ----------------------------------------------------
        budgets = Budget.query.filter_by(user_id=user_id, month=current_month, year=current_year).all()
        
        if budgets:
            for budget in budgets:
                cat_id = budget.category_id
                cat_budget_amount = float(budget.amount)
                
                cat_expense_df = current_expense_df[current_expense_df['category_id'] == cat_id]
                cat_expense_amount = float(cat_expense_df['amount'].sum()) if not cat_expense_df.empty else 0.0
                
                if cat_budget_amount > 0:
                    percentage = (cat_expense_amount / cat_budget_amount) * 100
                    category = Category.query.get(int(cat_id))
                    category_name = category.name if category else f"Category #{cat_id}"
                    
                    if percentage >= 100:
                        recommendations.append({
                            'message': f"BUDGET OVERRUN: You have spent {(percentage - 100):.1f}% over your limit for '{category_name}' (Spent {cat_expense_amount:,.0f} ₫ / Budget {cat_budget_amount:,.0f} ₫). Consider freezing discretionary expenses here immediately.",
                            'potential_savings': float(cat_expense_amount - cat_budget_amount)
                        })
                    elif percentage >= 80:
                        recommendations.append({
                            'message': f"BUDGET WARNING: Spending for '{category_name}' has reached {percentage:.1f}% of your allocated limit (Spent {cat_expense_amount:,.0f} ₫ / Limit {cat_budget_amount:,.0f} ₫). Please watch your next transactions.",
                            'potential_savings': float(cat_budget_amount * 0.1)
                        })
        else:
            recommendations.append({
                'message': "No active budgets found for this month! We highly recommend setting up category budgets to save an average of 15% more of your income.",
                'potential_savings': float(total_expense_current * 0.15) if total_expense_current > 0 else 50.0
            })

        # ----------------------------------------------------
        # Rule 2: Savings Potential & Detailed 50/30/20 Rebalancer
        # ----------------------------------------------------
        if total_income_current > 0:
            savings = total_income_current - total_expense_current
            
            # Categorize into Needs and Wants
            needs_spending = 0.0
            wants_spending = 0.0
            needs_breakdown = {}
            wants_breakdown = {}
            
            needs_keywords = {
                'food', 'groceries', 'rent', 'utilities', 'transport', 'transportation', 
                'bills', 'health', 'medical', 'education', 'insurance', 'gas',
                'hộ khẩu', 'điện', 'nước', 'học phí', 'xăng', 'ăn uống', 'nhà cửa', 'đi lại', 'thuốc'
            }
            
            for _, row in current_expense_df.iterrows():
                row_cat_id = int(row['category_id'])
                amount = float(row['amount'])
                category = Category.query.get(row_cat_id)
                cat_name = category.name if category else "Other"
                
                is_need = False
                for kw in needs_keywords:
                    if kw in cat_name.lower():
                        is_need = True
                        break
                
                if is_need:
                    needs_spending += amount
                    needs_breakdown[cat_name] = needs_breakdown.get(cat_name, 0.0) + amount
                else:
                    wants_spending += amount
                    wants_breakdown[cat_name] = wants_breakdown.get(cat_name, 0.0) + amount
            
            target_needs = total_income_current * 0.50
            target_wants = total_income_current * 0.30
            target_savings = total_income_current * 0.20
            
            needs_percentage = (needs_spending / total_income_current) * 100
            wants_percentage = (wants_spending / total_income_current) * 100
            savings_percentage = (savings / total_income_current) * 100
            
            if savings < 0 or needs_spending > target_needs or wants_spending > target_wants:
                msg_parts = []
                potential_savings_val = 0.0
                
                if needs_spending > target_needs:
                    excess_needs = needs_spending - target_needs
                    potential_savings_val += excess_needs
                    top_need_cat = max(needs_breakdown, key=needs_breakdown.get) if needs_breakdown else "essentials"
                    msg_parts.append(f"Reduce Essential spending (currently {needs_percentage:.1f}%) by ${excess_needs:.2f} to hit the 50% target (${target_needs:.2f}) - check your '{top_need_cat}' spending.")
                
                if wants_spending > target_wants:
                    excess_wants = wants_spending - target_wants
                    potential_savings_val += excess_wants
                    top_want_cat = max(wants_breakdown, key=wants_breakdown.get) if wants_breakdown else "lifestyle"
                    msg_parts.append(f"Cut Lifestyle/Discretionary spending (currently {wants_percentage:.1f}%) by ${excess_wants:.2f} to hit the 30% target (${target_wants:.2f}) - we suggest cutting back on '{top_want_cat}' immediately.")
                
                if savings < target_savings:
                    deficit_savings = target_savings - savings
                    msg_parts.append(f"Boost your savings allocation (currently {savings_percentage:.1f}%) by ${deficit_savings:.2f} to secure the recommended 20% savings cushion (${target_savings:.2f}).")
                
                if msg_parts:
                    recommendations.append({
                        'message': "50/30/20 BUDGET SOLUTION: " + " ".join(msg_parts),
                        'potential_savings': float(potential_savings_val) if potential_savings_val > 0 else float(target_savings)
                    })
            else:
                recommendations.append({
                    'message': f"Excellent budgeting! Your spending matches the 50/30/20 rule (Needs: {needs_percentage:.1f}%, Wants: {wants_percentage:.1f}%, Savings: {savings_percentage:.1f}%). Move your surplus of ${savings:.2f} into automated investments.",
                    'potential_savings': float(savings)
                })
        elif total_expense_current > 0:
            recommendations.append({
                'message': f"You have logged ${total_expense_current:.2f} in expenses this month without any income records. Add your income streams to unlock our customized 50/30/20 balance generator.",
                'potential_savings': 0.0
            })

        # ----------------------------------------------------
        # Rule 4: Weekend vs Weekday Spending spikes
        # ----------------------------------------------------
        if not expense_df.empty:
            weekday_expenses = expense_df[expense_df['day_of_week'] < 5]
            weekend_expenses = expense_df[expense_df['day_of_week'] >= 5]
            
            weekday_days = weekday_expenses['date'].nunique()
            weekend_days = weekend_expenses['date'].nunique()
            
            avg_weekday = (weekday_expenses['amount'].sum() / weekday_days) if weekday_days > 0 else 0.0
            avg_weekend = (weekend_expenses['amount'].sum() / weekend_days) if weekend_days > 0 else 0.0
            
            if avg_weekday > 0 and avg_weekend > avg_weekday * 1.5:
                ratio = avg_weekend / avg_weekday
                recommendations.append({
                    'message': f"WEEKEND SPIKE DETECTED: Daily weekend spending is {ratio:.1f}x higher than weekdays (${avg_weekend:.2f} vs ${avg_weekday:.2f}). We recommend reducing non-essential dining/entertainment on Saturdays and Sundays.",
                    'potential_savings': float((avg_weekend - avg_weekday) * weekend_days * 0.3)
                })

        # ----------------------------------------------------
        # Baseline Rules (Unusual & Recurring Expenses) translated to English
        # ----------------------------------------------------
        category_spending = expense_df.groupby('category_id')['amount'].sum().sort_values(ascending=False)
        
        if not category_spending.empty:
            top_category_id = category_spending.index[0]
            top_category = Category.query.get(int(top_category_id))
            top_amount = float(category_spending.iloc[0])
            total_expense = float(expense_df['amount'].sum())
            
            if top_category and total_expense > 0 and (top_amount / total_expense) > 0.4:
                recommendations.append({
                    'message': f"HIGH RATIO: Spending on '{top_category.name}' represents {top_amount/total_expense*100:.1f}% of your historical expenses ({top_amount:,.0f} ₫). We recommend setting a targeted monthly budget.",
                    'potential_savings': float(top_amount * 0.2)
                })
        
        daily_spending = expense_df.groupby('date')['amount'].sum()
        if len(daily_spending) > 5:
            mean_spending = float(daily_spending.mean())
            std_spending = float(daily_spending.std())
            unusual_days = daily_spending[daily_spending > mean_spending + 2*std_spending]
            
            if not unusual_days.empty:
                savings = float((unusual_days - mean_spending).sum() * 0.5)
                recommendations.append({
                    'message': f"UNUSUAL TRANSACTION SPIKES: Detected {len(unusual_days)} days with unusually high spending patterns compared to your daily average. Audit these days to spot leaks.",
                    'potential_savings': float(savings)
                })
        
        from collections import Counter
        amounts = [float(x) for x in expense_df['amount'].round(-1).tolist()]
        amount_counts = Counter(amounts)
        
        for amount, count in amount_counts.most_common(3):
            if count >= 3 and amount > 0:
                recommendations.append({
                    'message': f"RECURRING EXPENSE ALERT: A consistent expense of approximately ${amount:.2f} was charged {count} times. Check if this is an unwanted subscription you can safely cancel.",
                    'potential_savings': float(amount * count * 0.3)
                })
                
        seen_msgs = set()
        unique_recs = []
        for r in recommendations:
            if r['message'] not in seen_msgs:
                seen_msgs.add(r['message'])
                unique_recs.append(r)
                
        return unique_recs[:6]
    
    def get_category_trends(self, user_id):
        """Analyze spending trends by category"""
        df = self.get_user_transactions_data(user_id)
        
        if df.empty:
            return []
        
        expense_df = df[df['type'] == 'expense']
        
        # Get current and last month
        current_date = datetime.now()
        current_month = current_date.month
        current_year = current_date.year
        
        current_month_data = expense_df[
            (expense_df['month'] == current_month) & 
            (expense_df['year'] == current_year)
        ]
        
        last_month = current_month - 1 if current_month > 1 else 12
        last_month_year = current_year if current_month > 1 else current_year - 1
        
        last_month_data = expense_df[
            (expense_df['month'] == last_month) & 
            (expense_df['year'] == last_month_year)
        ]
        
        # Group by category
        current_category = current_month_data.groupby('category_id')['amount'].sum()
        last_category = last_month_data.groupby('category_id')['amount'].sum()
        
        # Get all unique categories
        all_categories = set(current_category.index) | set(last_category.index)
        
        trends = []
        for cat_id in all_categories:
            category = Category.query.get(int(cat_id))
            if category:
                current = current_category.get(cat_id, 0)
                previous = last_category.get(cat_id, 0)
                change = ((current - previous) / previous * 100) if previous > 0 else 0
                
                trends.append({
                    'name': category.name,
                    'current': float(current),
                    'previous': float(previous),
                    'change': change
                })
        
        return sorted(trends, key=lambda x: abs(x['change']), reverse=True)
    
    def detect_anomalies(self, user_id):
        """Detect anomalous spending patterns"""
        df = self.get_user_transactions_data(user_id)
        
        if df.empty:
            return []
        
        expense_df = df[df['type'] == 'expense']
        
        anomalies = []
        
        # Use IQR method for anomaly detection
        amounts = expense_df['amount'].values
        
        if len(amounts) > 5:
            Q1 = np.percentile(amounts, 25)
            Q3 = np.percentile(amounts, 75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            anomalies_df = expense_df[(expense_df['amount'] < lower_bound) | (expense_df['amount'] > upper_bound)]
            
            for _, row in anomalies_df.iterrows():
                category = Category.query.get(int(row['category_id']))
                anomalies.append({
                    'date': row['date'].isoformat(),
                    'amount': float(row['amount']),
                    'category': category.name if category else 'Unknown',
                    'is_high': bool(row['amount'] > upper_bound)
                })
        
        return anomalies