#include <iostream>
using namespace std;

int main ()
{
    int N, a, qtd = 0;
    
    // qtd = quantidade de divisieis
    
    cin >> N;
    
    for (int i = 0; i < N; i++){
        
        cin >> a;
        
        if (a % 3 == 0){
         
         qtd = qtd + 1;   
            
        }
    }
    
    cout << qtd << endl;
    
    return 0;
}