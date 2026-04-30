#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    int n;
    int maiorAltura = 0;
    int menorAltura = 0;
    
    cin >> n;
    
    for(int i = 0; i < n; i++){
        cin >> n;
    
            if(n > maiorAltura){
                maiorAltura = n;
            }
            if(n < menorAltura){
                menorAltura = n;
            }
           
        }
            
            
        cout << fixed << setprecision(2);
        cout << "Menor altura: " << menorAltura << endl;
        cout << "Maior altura: " << maiorAltura << endl;
        
        return 0;
        
}
