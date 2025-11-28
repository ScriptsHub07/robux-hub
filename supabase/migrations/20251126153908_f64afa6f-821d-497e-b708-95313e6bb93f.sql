-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'buyer');

-- Create order_status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'disputed');

-- Create delivery_method enum
CREATE TYPE public.delivery_method AS ENUM ('gamepass', 'donation', 'group_payout');

-- Create withdrawal_status enum
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'completed', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create sellers table
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  price_per_1k DECIMAL(10, 2) NOT NULL CHECK (price_per_1k > 0),
  min_amount INTEGER NOT NULL CHECK (min_amount > 0),
  max_amount INTEGER NOT NULL CHECK (max_amount >= min_amount),
  is_online BOOLEAN DEFAULT FALSE NOT NULL,
  total_sales INTEGER DEFAULT 0 NOT NULL,
  average_rating DECIMAL(3, 2) DEFAULT 0.00 NOT NULL CHECK (average_rating >= 0 AND average_rating <= 5),
  total_ratings INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  total_price DECIMAL(10, 2) NOT NULL CHECK (total_price > 0),
  delivery_method public.delivery_method NOT NULL,
  status public.order_status DEFAULT 'pending' NOT NULL,
  proof_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'purchase', 'sale', 'withdrawal')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  status public.withdrawal_status DEFAULT 'pending' NOT NULL,
  payment_method TEXT,
  payment_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  
  -- Assign buyer role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update seller average rating
CREATE OR REPLACE FUNCTION public.update_seller_rating()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sellers
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.ratings
      WHERE seller_id = NEW.seller_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM public.ratings
      WHERE seller_id = NEW.seller_id
    )
  WHERE id = NEW.seller_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for rating updates
CREATE TRIGGER on_rating_created
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_seller_rating();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles" ON public.user_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sellers
CREATE POLICY "Everyone can view sellers" ON public.sellers
  FOR SELECT USING (true);

CREATE POLICY "Sellers can update own data" ON public.sellers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage sellers" ON public.sellers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (
    auth.uid() = buyer_id OR
    auth.uid() IN (SELECT user_id FROM public.sellers WHERE id = seller_id) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Buyers can create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers and admins can update orders" ON public.orders
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.sellers WHERE id = seller_id) OR
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for ratings
CREATE POLICY "Everyone can view ratings" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "Buyers can create ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in own orders" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND (
        buyer_id = auth.uid() OR
        seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
      )
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can send messages in own orders" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND (
        buyer_id = auth.uid() OR
        seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
      )
    )
  );

-- RLS Policies for withdrawals
CREATE POLICY "Sellers can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.sellers WHERE id = seller_id) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Sellers can create withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.sellers WHERE id = seller_id)
  );

CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_ratings_seller_id ON public.ratings(seller_id);
CREATE INDEX idx_chat_messages_order_id ON public.chat_messages(order_id);
CREATE INDEX idx_withdrawals_seller_id ON public.withdrawals(seller_id);