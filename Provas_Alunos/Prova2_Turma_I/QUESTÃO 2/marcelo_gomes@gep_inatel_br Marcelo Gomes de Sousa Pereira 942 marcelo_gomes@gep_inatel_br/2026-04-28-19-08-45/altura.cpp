#include <iostream>
#include <iomanip>

using namespace std;

int main ()
{
    float a, b, c;
    int N, menor = 0, maior = 99;
    
    cin >> N;
    
    for (int i = 0; i < N; i++){
        
        cin >> c;
        
        if (c > menor){
            
            menor = c;
            c = a;
            
        }
        
        else if (c > a && c < maior){
            
            maior = c;
            c = b;
            
        }
    }   
    
    cout << fixed << setprecison (2);
    cout << "Menor altura: " << a << endl;
    
    cout << fixed << setprecision (2);
    cout << "Maior altura: " << b << endl;
    
    
    return 0;
}