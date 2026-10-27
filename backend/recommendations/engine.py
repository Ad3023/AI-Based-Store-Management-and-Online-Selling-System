"""
AI Recommendation Engine for Online Selling System
===================================================
Technologies: Python, Pandas, Scikit-learn (TfidfVectorizer, cosine_similarity, KMeans, StandardScaler)

Features:
1. Content-Based Filtering: TF-IDF vectorization on product titles, categories, and descriptions.
2. Frequently Bought Together / Item Association: Co-occurrence probability from order history.
3. Personalized Recommendations: Aggregates customer viewing and purchasing history to suggest relevant products.
4. Trending & Popular Fallback: Ranks products by sales velocity, view counts, and customer reviews.
5. RFM Customer Segmentation: K-Means clustering on Recency, Frequency, and Monetary metrics.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from django.db.models import Count, Sum, Q
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except (ImportError, Exception):
    SKLEARN_AVAILABLE = False

from products.models import Product
from orders.models import Order, OrderItem
from recommendations.models import CustomerActivity, CustomerSegment


class AIRecommendationEngine:
    @staticmethod
    def get_content_based_recommendations(product_id, top_n=6):
        """
        Calculates cosine similarity between the given product and all active products
        using TF-IDF vectors of (Name + Category + Description).
        """
        products = list(Product.objects.filter(is_active=True))
        if len(products) <= 1:
            return []

        # Build corpus
        product_ids = [p.id for p in products]
        corpus = [
            f"{p.name} {p.category.name} {p.description or ''}"
            for p in products
        ]

        if product_id not in product_ids:
            return AIRecommendationEngine.get_trending_products(top_n=top_n)

        target_idx = product_ids.index(product_id)

        try:
            if not SKLEARN_AVAILABLE:
                return AIRecommendationEngine.get_trending_products(top_n=top_n)
            vectorizer = TfidfVectorizer(stop_words='english', min_df=1, max_features=3000)
            tfidf_matrix = vectorizer.fit_transform(corpus)
            similarity_scores = cosine_similarity(tfidf_matrix[target_idx], tfidf_matrix).flatten()

            # Sort indices descending (excluding target product itself)
            similar_indices = similarity_scores.argsort()[::-1]
            ranked_ids = [
                product_ids[idx]
                for idx in similar_indices
                if product_ids[idx] != product_id
            ][:top_n]

            # Maintain ranked order
            preserved_order = {pid: i for i, pid in enumerate(ranked_ids)}
            recommended = list(Product.objects.filter(id__in=ranked_ids))
            recommended.sort(key=lambda p: preserved_order.get(p.id, 999))
            return recommended
        except Exception as e:
            # Fallback if corpus cannot be vectorized
            return AIRecommendationEngine.get_trending_products(top_n=top_n)

    @staticmethod
    def get_frequently_bought_together(product_id, top_n=4):
        """
        Calculates co-occurrence of products in completed customer orders.
        Finds products that appear in the same orders as `product_id`.
        """
        # Find all orders containing the target product
        target_orders = OrderItem.objects.filter(
            product_id=product_id
        ).values_list('order_id', flat=True)

        if not target_orders:
            # Fallback to category/content-based recommendations
            return AIRecommendationEngine.get_content_based_recommendations(product_id, top_n=top_n)

        # Count occurrences of other products in these orders
        co_purchased = (
            OrderItem.objects.filter(order_id__in=target_orders)
            .exclude(product_id=product_id)
            .values('product_id')
            .annotate(co_count=Count('id'))
            .order_by('-co_count')[:top_n]
        )

        pids = [item['product_id'] for item in co_purchased]
        if not pids:
            return AIRecommendationEngine.get_content_based_recommendations(product_id, top_n=top_n)

        order_map = {pid: i for i, pid in enumerate(pids)}
        products = list(Product.objects.filter(id__in=pids, is_active=True))
        products.sort(key=lambda p: order_map.get(p.id, 999))
        return products

    @staticmethod
    def get_personalized_recommendations(user, top_n=8):
        """
        Personalized AI recommendations based on customer's purchase and viewing history.
        Uses TF-IDF profile matching against customer's recent interests.
        Falls back to trending items if the user is new or has no history.
        """
        if not user or not user.is_authenticated:
            return AIRecommendationEngine.get_trending_products(top_n=top_n)

        # 1. Collect product IDs user has purchased
        purchased_pids = list(
            OrderItem.objects.filter(order__customer=user)
            .values_list('product_id', flat=True)
            .distinct()
        )

        # 2. Collect product IDs user has viewed or added to cart
        viewed_pids = list(
            CustomerActivity.objects.filter(user=user)
            .order_by('-created_at')
            .values_list('product_id', flat=True)[:15]
        )

        interacted_pids = list(dict.fromkeys(purchased_pids + viewed_pids))

        if not interacted_pids:
            # Fallback for new customers
            return AIRecommendationEngine.get_trending_products(top_n=top_n)

        # Gather texts from interacted products to build customer interest profile
        interacted_products = Product.objects.filter(id__in=interacted_pids)
        customer_profile_text = " ".join([
            f"{p.name} {p.category.name} {p.description or ''}"
            for p in interacted_products
        ])

        # Candidate pool: active products that the customer hasn't purchased yet
        candidates = list(
            Product.objects.filter(is_active=True)
            .exclude(id__in=purchased_pids)
        )

        if not candidates:
            candidates = list(Product.objects.filter(is_active=True))

        if not candidates:
            return []

        candidate_ids = [p.id for p in candidates]
        candidate_corpus = [
            f"{p.name} {p.category.name} {p.description or ''}"
            for p in candidates
        ]

        try:
            vectorizer = TfidfVectorizer(stop_words='english', min_df=1, max_features=3000)
            candidate_matrix = vectorizer.fit_transform(candidate_corpus)
            profile_vec = vectorizer.transform([customer_profile_text])

            scores = cosine_similarity(profile_vec, candidate_matrix).flatten()
            ranked_indices = scores.argsort()[::-1][:top_n]

            ranked_pids = [candidate_ids[idx] for idx in ranked_indices]
            rank_map = {pid: i for i, pid in enumerate(ranked_pids)}

            recommended = list(Product.objects.filter(id__in=ranked_pids))
            recommended.sort(key=lambda p: rank_map.get(p.id, 999))
            return recommended
        except Exception:
            return AIRecommendationEngine.get_trending_products(top_n=top_n)

    @staticmethod
    def get_trending_products(top_n=8):
        """
        Popular & trending product algorithm for new customers or fallback.
        Ranks products by total units sold, recent views, and rating.
        """
        # Annotated sold count and activity count
        products = Product.objects.filter(is_active=True).annotate(
            total_sold=Sum('order_items__quantity', default=0),
            total_views=Count('activities', filter=Q(activities__activity_type='VIEW')),
        ).order_by('-total_sold', '-total_views', '-rating_average')[:top_n]

        return list(products)

    @staticmethod
    def run_customer_segmentation():
        """
        Performs K-Means clustering on Customer RFM (Recency, Frequency, Monetary) data.
        Updates or creates records in CustomerSegment table.
        Returns a summary report dictionary for store managers.
        """
        from accounts.models import User

        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            return {"status": "No customers available for segmentation", "segments": []}

        now = datetime.now(timezone.utc)
        customer_data = []

        for cust in customers:
            orders = Order.objects.filter(customer=cust)
            order_count = orders.count()
            total_spent = float(orders.aggregate(total=Sum('total_amount'))['total'] or 0.0)

            last_order = orders.order_by('-created_at').first()
            if last_order:
                recency_days = (now - last_order.created_at).days
            else:
                recency_days = 999  # No orders yet

            avg_order_value = total_spent / order_count if order_count > 0 else 0.0

            customer_data.append({
                'user': cust,
                'user_id': cust.id,
                'username': cust.username,
                'recency_days': recency_days,
                'order_count': order_count,
                'total_spent': total_spent,
                'avg_order_value': avg_order_value
            })

        df = pd.DataFrame(customer_data)

        # Features for clustering
        feature_cols = ['recency_days', 'order_count', 'total_spent', 'avg_order_value']
        features = df[feature_cols].copy()

        # Handle small dataset edge cases
        num_clusters = min(4, len(df))
        if num_clusters < 2:
            # Assign all to New / Single cluster
            for row in customer_data:
                CustomerSegment.objects.update_or_create(
                    user=row['user'],
                    defaults={
                        'segment_name': 'New Customer' if row['order_count'] == 0 else 'Active Shopper',
                        'cluster_id': 0,
                        'total_spent': row['total_spent'],
                        'order_count': row['order_count'],
                        'avg_order_value': row['avg_order_value'],
                        'last_order_days': row['recency_days'] if row['recency_days'] < 999 else 0,
                        'suggested_action': 'Send welcome discount code and onboarding guide.'
                    }
                )
            return {"status": "Updated", "total_segmented": len(customer_data)}

        # Scaling and K-Means
        if SKLEARN_AVAILABLE:
            scaler = StandardScaler()
            scaled_features = scaler.fit_transform(features)
            kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
            df['cluster'] = kmeans.fit_predict(scaled_features)
        else:
            # Robust quantile-based clustering fallback when sklearn is unavailable
            df = df.sort_values(by=['total_spent', 'order_count'], ascending=False).reset_index(drop=True)
            chunk_size = max(1, len(df) // num_clusters)
            df['cluster'] = [min(i // chunk_size, num_clusters - 1) for i in range(len(df))]

        # Label clusters based on cluster centroids
        cluster_summaries = df.groupby('cluster')[feature_cols].mean()
        
        # Sort clusters by total_spent mean to assign logical names
        sorted_clusters = cluster_summaries.sort_values(by='total_spent', ascending=False).index.tolist()
        
        segment_labels = {}
        suggested_actions = {}

        if num_clusters >= 4:
            segment_labels[sorted_clusters[0]] = "High-Value Champions"
            suggested_actions[sorted_clusters[0]] = "Provide VIP priority support and early access to new arrivals."

            segment_labels[sorted_clusters[1]] = "Loyal Frequent Buyers"
            suggested_actions[sorted_clusters[1]] = "Offer volume bundles and loyalty reward points."

            segment_labels[sorted_clusters[2]] = "Occasional Shoppers"
            suggested_actions[sorted_clusters[2]] = "Send personalized recommendations and seasonal discount coupons."

            segment_labels[sorted_clusters[3]] = "New & At-Risk Prospects"
            suggested_actions[sorted_clusters[3]] = "Trigger re-engagement emails and showcase trending bestsellers."
        elif num_clusters == 3:
            segment_labels[sorted_clusters[0]] = "High-Value Champions"
            suggested_actions[sorted_clusters[0]] = "Provide VIP priority support and early access."

            segment_labels[sorted_clusters[1]] = "Regular Active Shoppers"
            suggested_actions[sorted_clusters[1]] = "Offer personalized product recommendations."

            segment_labels[sorted_clusters[2]] = "Occasional & New Visitors"
            suggested_actions[sorted_clusters[2]] = "Encourage second purchase with welcome coupon."
        else:
            segment_labels[sorted_clusters[0]] = "High-Value Active Buyers"
            suggested_actions[sorted_clusters[0]] = "Reward loyalty with exclusive perks."

            segment_labels[sorted_clusters[1]] = "Casual Shoppers"
            suggested_actions[sorted_clusters[1]] = "Send attractive offers on top-selling items."

        # Save to database
        for _, row in df.iterrows():
            c_id = row['cluster']
            seg_name = segment_labels.get(c_id, f"Cluster {c_id}")
            action = suggested_actions.get(c_id, "Monitor engagement.")

            CustomerSegment.objects.update_or_create(
                user=row['user'],
                defaults={
                    'segment_name': seg_name,
                    'cluster_id': int(c_id),
                    'total_spent': row['total_spent'],
                    'order_count': row['order_count'],
                    'avg_order_value': row['avg_order_value'],
                    'last_order_days': row['recency_days'] if row['recency_days'] < 999 else 0,
                    'suggested_action': action
                }
            )

        return {
            "status": "Success",
            "total_segmented": len(df),
            "clusters": [
                {
                    "cluster_id": int(cid),
                    "name": segment_labels.get(cid, f"Cluster {cid}"),
                    "count": int((df['cluster'] == cid).sum()),
                    "avg_spent": float(cluster_summaries.loc[cid, 'total_spent']),
                    "avg_orders": float(cluster_summaries.loc[cid, 'order_count']),
                    "suggested_action": suggested_actions.get(cid, "")
                }
                for cid in sorted_clusters
            ]
        }
