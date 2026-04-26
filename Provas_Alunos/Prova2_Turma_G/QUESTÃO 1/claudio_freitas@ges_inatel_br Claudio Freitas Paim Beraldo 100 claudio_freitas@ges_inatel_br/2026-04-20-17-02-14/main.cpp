#include<iostream>
#include<cstring>

    using namespace std;
    
    
    int main()
{
    int n;
    cin>>n;
    
    int X;
    int par=0;
    int impar=0;
    int negativos;
    
    
    
    for(int i=0;i<=n;i++)
    {
      cin>>X;
        
    
         if(X<0)
          {
             negativos=X;
             cout<<negativos<<" numeros negativos"<<endl;
          }    
        
        
    }
    
    
    
    
    
    
    
    return 0;
}    