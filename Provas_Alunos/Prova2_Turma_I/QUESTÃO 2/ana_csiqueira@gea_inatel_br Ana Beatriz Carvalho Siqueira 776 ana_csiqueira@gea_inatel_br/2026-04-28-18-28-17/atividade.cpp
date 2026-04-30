#include <iostream>
using namespace std;
int main (){
    
    int n;
    float altura;
    
    cin >> n;
    cin >> altura;
    
      while(altura!=2){
        if(altura <=2){
            cout << "Menor altura" << endl;
        
        }else if (altura >2){
            cout << "Maior altura" << endl;
        }
        
        cout << fixed << setprecision(2);
        cin >> n >> altura;

    }
return 0;
}