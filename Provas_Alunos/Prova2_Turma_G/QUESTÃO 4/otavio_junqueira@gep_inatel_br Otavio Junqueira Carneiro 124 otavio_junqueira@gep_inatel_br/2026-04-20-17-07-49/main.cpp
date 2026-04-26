#include <iostream>

using namespace std;

int main ()
{
    double vetor[100];
    int num;
    int N = -1;
    
    while (num != 0);
    {
      cin >> vetor[N];
      N++;
        
     
    
    
        int x;
        
        if(N > 0){
            
            for(int i =0; i< N; i++ )
            {
                if(x == vetor[i])
                {
                    cout << x << " encontrado na posicao " << i << endl;
                }else 
                {
                    cout << "Elemento nao encontrado" << endl;    
                }
            }
        }
    }
    
    return 0;
}