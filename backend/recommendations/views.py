from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import CustomerSegment, CustomerActivity
from .serializers import CustomerSegmentSerializer, CustomerActivitySerializer
from .engine import AIRecommendationEngine
from products.serializers import ProductSerializer
from products.models import Product
from accounts.permissions import IsStoreManagerOrAdmin


class PersonalizedRecommendationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        top_n = int(request.query_params.get('limit', 8))
        products = AIRecommendationEngine.get_personalized_recommendations(request.user, top_n=top_n)
        return Response({
            'algorithm': 'Personalized Interest Profile (TF-IDF Vector Space & Purchase History)',
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class SimilarProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        top_n = int(request.query_params.get('limit', 6))
        products = AIRecommendationEngine.get_content_based_recommendations(product_id, top_n=top_n)
        return Response({
            'algorithm': 'Content-Based Cosine Similarity (TF-IDF on Product Features)',
            'product_id': product_id,
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class FrequentlyBoughtTogetherView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        top_n = int(request.query_params.get('limit', 4))
        products = AIRecommendationEngine.get_frequently_bought_together(product_id, top_n=top_n)
        return Response({
            'algorithm': 'Order Item Co-occurrence Pattern Analysis',
            'product_id': product_id,
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class TrendingProductsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        top_n = int(request.query_params.get('limit', 8))
        products = AIRecommendationEngine.get_trending_products(top_n=top_n)
        return Response({
            'algorithm': 'Sales Velocity, View Density & Customer Ratings',
            'count': len(products),
            'results': ProductSerializer(products, many=True).data
        })


class CustomerSegmentationView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

    def get(self, request):
        # Auto-run if empty
        if not CustomerSegment.objects.exists():
            AIRecommendationEngine.run_customer_segmentation()

        segments = CustomerSegment.objects.all()
        serializer = CustomerSegmentSerializer(segments, many=True)

        # Aggregate cluster counts
        clusters = {}
        for s in segments:
            cid = s.cluster_id
            if cid not in clusters:
                clusters[cid] = {
                    'cluster_id': cid,
                    'name': s.segment_name,
                    'count': 0,
                    'suggested_action': s.suggested_action,
                    'total_spent': 0.0
                }
            clusters[cid]['count'] += 1
            clusters[cid]['total_spent'] += float(s.total_spent)

        return Response({
            'algorithm': 'K-Means Clustering on RFM (Recency, Frequency, Monetary)',
            'total_customers_segmented': segments.count(),
            'clusters_summary': list(clusters.values()),
            'customers': serializer.data
        })

    def post(self, request):
        # Trigger re-clustering model
        result = AIRecommendationEngine.run_customer_segmentation()
        return Response({
            'message': 'AI Customer segmentation model retrained successfully.',
            'details': result
        }, status=status.HTTP_200_OK)


class TrackActivityView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        product_id = request.data.get('product_id')
        activity_type = request.data.get('activity_type', CustomerActivity.ActivityType.VIEW)
        session_key = request.data.get('session_id') or request.session.session_key

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user if request.user.is_authenticated else None

        activity = CustomerActivity.objects.create(
            user=user,
            session_key=session_key,
            product=product,
            activity_type=activity_type
        )
        return Response(CustomerActivitySerializer(activity).data, status=status.HTTP_201_CREATED)
